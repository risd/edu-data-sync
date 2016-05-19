var request = require('request');
var moment = require('moment');
var timezone = require('moment-timezone');
var through = require('through2');

var whUtil = require('../whUtil.js')();

module.exports = Events;

/**
 * Events are powered by the Localist API.
 */
function Events () {
    if (!(this instanceof Events)) return new Events();
    var self = this;

    this.url = {
        base: 'https://events.risd.edu/api/2.1/'
    };
    this.url._events = this.url.base + 'events';
    this.url.events = function (opts) {
        var u = [self.url._events];
        if ('page' in opts) {
            u = u.concat([
                '/?',
                'page=',
                opts.page.current,
                '&',
                'pp=100'
            ]);
            if ('days' in opts) {
                u = u.concat([
                    '&',
                    'days=',
                    opts.days
                ]);
            }
        }
        else if ('days' in opts) {
            u = u.concat([
                '/?',
                'days=',
                opts.days,
                '&',
                'pp=100'
            ]);
        }

        return u.join('');
    };
}

Events.prototype.webhookContentType = 'events';
Events.prototype.keyFromWebhook = function (row) {
    return row.localist_uid;
};
Events.prototype.keyFromSource = function (row) {
    return row.event.id;
};

Events.prototype.listSource = function () {
    var self = this;
    console.log('Events.listSource::start');

    // stream of Event objects from localist
    var eventStream = through.obj();
    // stream that controls paginated requests
    // to localist
    var pagingStream = through.obj();

    // Push paging query options into
    // the paging stream to have the
    // pushed into the eventStream
    // This is the business.
    pagingStream.pipe(RecursivePage());

    // End the business.
    pagingStream.on('end', function () {
        // End the return stream that is
        // writing events.
        console.log('Events.listSource::end');
        eventStream.push(null);
    });

    var frmtString = 'YYYY-MM-DD';

    var initialPageQueryOpts = {
        days: 365
    };

    pagingStream.push(initialPageQueryOpts);


    return eventStream;

    function RecursivePage () {
        return through.obj(pg);

        function pg (pageQueryOpts, enc, next) {
            var req = getEvents(pageQueryOpts);

            req.on('data', function (data) {
                if ('events' in data) {
                    data.events.forEach(function (e) {
                        eventStream.push(e);
                    });
                }
                if ('page' in data) {
                    pageQueryOpts.page = data.page;
                }
            });

            req.on('end', function () {
                if (pageQueryOpts.page.current <
                    pageQueryOpts.page.total) {

                    pageQueryOpts.page.current += 1;
                    pagingStream.push(pageQueryOpts);

                } else {
                    pagingStream.push(null);
                }
                next();
            });
        }

        function getEvents (opts) {
            var t = through.obj();
            var u = self.url.events(opts);
            console.log('Localist events fetch: ' + u);

            var data = [];
            request.get(u)
                .pipe(through.obj(function (row, enc, next) {
                    data.push(row.toString());
                    next();
                }, function end () {
                    try {
                        var events = JSON.parse(data.join(''));
                        t.push(events);
                    } catch (err) {
                        console.log(err);
                        var e = [
                            'Error getting localist events. ',
                            'Need to have all of the events, ',
                            'before Firebase differences can ',
                            'be accounted for.\n',
                            'Try again shortly.'
                        ];
                        throw new Error(e.join(''));
                    }
                    t.push(null);
                }));

            return t;
        }
    }
};


Events.prototype.sourceStreamToFirebaseSource = function () {
    var self = this;

    return through.obj(toFirebase);

    function toFirebase (row, enc, next) {
        var stream = this;

        // check to see if this key
        // has already been added
        var key = self.keyFromSource(row);
        self._firebase
            .source
            .child(key)
            .once('value', onCheckComplete, onCheckError);

        function onCheckError (error) {
            console.log(error);
            onAddComplete();
        }

        function onCheckComplete (snapshot) {
            var value = snapshot.val();

            // value exists add instance times
            if (value) {
                var instances = value.event
                                     .event_instances
                                     .concat(row.event
                                                .event_instances);

                self._firebase
                    .source
                    .child(key)
                    .child('event')
                    .child('event_instances')
                    .set(instances, onAddComplete);

            }
            // value does not exist, add it
            else {
                self._firebase
                    .source
                    .child(key)
                    .set(row, onAddComplete);
            }
        }

        function onAddComplete () {
            next();
        }

    }
};


Events.prototype.updateWebhookValueWithSourceValue = function (wh, src) {
    src = src.event;

    wh.name = src.title + ' ' + src.id;
    wh.localist_title = src.title.trim();
    wh.localist_uid = src.id;
    wh.localist_venue_uid = src.venue_id || '';
    wh.localist_featured = src.featured || false;
    wh.localist_date_range_first =
        [src.first_date].map(addTimeZone)[0];
    wh.localist_date_range_last =
        [src.last_date].map(addTimeZone)[0];
    
    wh.within_date_range = isWithinDateRange(
        wh.localist_date_range_first,
        wh.localist_date_range_last);

    wh.upcoming = isUpcoming(wh.localist_date_range_last);
    

    wh.upcoming = isUpcoming(wh.localist_date_range_last);

    wh.localist_instances = src.event_instances
        .map(function (d) {
            if ((d.event_instance.all_day) ||
                (!('end' in d.event_instance))){
                d.event_instance.end = '';
            }
            return {
                start:   d.event_instance.start,
                end:     d.event_instance.end,
                all_day: d.event_instance.all_day,
                id:      d.event_instance.id
            };
        });
    wh.localist_url = src.localist_url || '';
    wh.localist_event_url = src.url || '';
    wh.localist_photo_url = src.photo_url || '';
    wh.localist_venue_url = src.venue_url || '';
    wh.localist_ticket_url = src.ticket_url || '';
    
    wh.localist_room_number = src.room_number || '';
    wh.localist_location_name = src.location_name || '';
    if (src.geo) {
        wh.localist_address = {
            city: src.geo.city || '',
            country: src.geo.country || '',
            state: src.geo.state || '',
            street1: src.geo.street || '',
            zip: src.geo.zip || '',
        };
        wh.localist_location_coordinates = {
            latitude: src.geo.latitude || '',
            longitude: src.geo.longitude || ''
        };
    }
    
    wh.localist_description_text = src.description_text || '';
    wh.localist_ticket_cost = src.ticket_cost || '';
    wh.localist_filters__department = (function (filters) {
            if ('departments' in filters) {
                return filters.departments.map(function (d) {
                    return { department: d.name };
                });
            } else {
                return [];
            }
            
        })(src.filters || {});
    wh.localist_filters__event_types = (function (filters) {
            if ('event_types' in filters) {
                return filters.event_types.map(function (d) {
                    return { name: d.name };
                });
            } else {
                return [];
            }
        })(src.filters || {});
    wh.is_draft = false;

    return (eventDateSort(
                whUtil.whRequiredDates(
                    wh)));

    function eventDateSort (d) {
        var fields = [
            'localist_date_range_first',
            'localist_date_range_last'
        ];

        fields.forEach(function (field) {
            if (field in d && (d[field])) {
                if (d[field].length > 0) {
                    var dt = new Date(d[field]);
                    d['_sort_' + field] = dt.getTime();
                }
            }
        });

        return d;
    }

    function addTimeZone (dateString) {
        return dateString + 'T00:00:00-04:00';
    }

    function isWithinDateRange (start, end) {
        /* The isBetween method of moment.js
           is not inclusive of the start and
           end days. Thus, start will have one
           day subtracted, and end will have
           one day added, and asking if `now`
           is in between will return true
           if `now` is between, including the
           start and the end day.
       */
        var now = timezone().tz('America/New_York');
        var inclusiveStart = moment(start).subtract(1, 'days');
        var inclusiveEnd = moment(end).add(1, 'days');
        return moment(now)
                    .isBetween(
                        inclusiveStart,
                        inclusiveEnd);
    }

    function isUpcoming (end) {
        var now = timezone().tz('America/New_York');
        var beginningOfDay = now
            .set('hour', 0)
            .set('minute', 0)
            .set('second', 0);
        return moment(beginningOfDay).isBefore(end);
    }
};

Events.prototype.relationshipsToResolve = function () {
    return [{
        multipleToRelate: true,
        relationshipKey: 'related_departments',
        relateToContentType: 'departments',
        relateToContentTypeDataUsingKey: 'name',
        itemsToRelate: []
    }, {
        multipleToRelate: false,
        relationshipKey: 'related_foundation_studies',
        relateToContentType: 'experimentalandfoundationstudies',
        itemToRelate: false
    }, {
        multipleToRelate: false,
        relationshipKey: 'related_graduate_studies',
        relateToContentType: 'graduatestudies',
        itemToRelate: false
    }, {
        multipleToRelate: true,
        relationshipKey: 'related_liberal_arts_departments',
        relateToContentType: 'liberalartsdepartments',
        relateToContentTypeDataUsingKey: 'name',
        itemsToRelate: []
    }];
};


Events.prototype.dataForRelationshipsToResolve = function (currentWHData) {
    var self = this;

    var toResolve = self.relationshipsToResolve();

    if ('localist_filters__department' in currentWHData) {
        var departments =
            currentWHData.localist_filters__department
                .map(function (d) {
                    return d.department;
                })
                .map(whUtil.webhookDepartmentForLocalist)
                .filter(function (d) {
                    return d !== false;
                })
                .map(function (d) {
                    return { departments: d };
                });

        toResolve[0].itemsToRelate = departments;

        var foundation =
            currentWHData.localist_filters__department
                .filter(function (d) {
                    return d.department ===
                           "Division of Foundation Studies";
                });
        if (foundation.length === 1) {
            toResolve[1].itemToRelate = true;
        }

        var graduate =
            currentWHData.localist_filters__department
                .filter(function (d) {
                    return d.department ===
                        "Division of Graduate Studies";
                });
        if (graduate.length === 1) {
            toResolve[2].itemToRelate = true;
        }

        var liberalArtsDepartments =
            currentWHData.localist_filters__department
                .map(function (d) {
                    return d.department;
                })
                .map(whUtil.webhookLiberalArtsDepartmentForLocalist)
                .filter(function (d) {
                    return d !== false;
                })
                .map(function (d) {
                    return { liberalartsdepartments: d };
                });

        toResolve[3].itemsToRelate = liberalArtsDepartments;
    }

    return toResolve;
};

/**
 * updateWebhookValueNotInSource implementation
 * for events. If they are in WebHook & not in
 * source, they are left alone. Since we are only
 * looking for future events. If an event has past
 * we keep it around for historical record.
 *
 * Basically a no-op stream
 *
 * @return {stream} through.obj transform stream
 */
Events.prototype.updateWebhookValueNotInSource = function () {
    var self = this;
    var now = moment();
    return through.obj(updateNotInSource);

    function updateNotInSource (row, enc, next) {
        var remove = false;
        if (row.inSource === false) {
            var endOfLastDayStr =
                [row.webhook.localist_date_range_last]
                    .map(addEndOfDay)
                    [0];
            if (moment(endOfLastDayStr).isAfter(now)) {
                // Not in the source, and in the future
                // means that it was removed.
                // if it was in the past, it means it wasn't
                // called in our API call.
                remove = true;
            }
        }

        if (remove) {
            var stream = this;
            self._firebase
                .webhook
                .child(row.whKey)
                .remove(function onComplete () {
                    row.whKey = undefined;
                    row.webhook = undefined;
                    next();
                });
        } else {
            next();
        }
    }

    function addEndOfDay (dateString) {
        return dateString.split('T')[0] +
               'T23:59:59-04:00';
    }
};
