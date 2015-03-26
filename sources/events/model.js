/*

Event from localist. Each event is accounted
for multiple times, but only written once.

If you want to account for individual event
instances. You can look at the event instance
id for the event.

value
    .event
    .event_instances[0]
    .event_instance
    .id

*/

var request = require('request');
var moment = require('moment');
var through = require('through2');

var whUtil = require('../whUtil.js')();

module.exports = Events;

function Events () {
    if (!(this instanceof Events)) return new Events();
    var self = this;
    // this.namespace = 'events';
    // this.firebase_webhook_path = 'data/events';
    // this.firebase_api_path = 'eduSync/events';

    this.url = {
        base: 'https://events.risd.edu/api/2/'
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
Events.prototype.webhookKeyName = 'localist_uid';
Events.prototype.keyFromWebhook = function (row) {
    return row.localist_uid;
};
Events.prototype.keyFromSource = function (row) {
    return row.event.id;
};

Events.prototype.listSource = function () {
    var self = this;

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

Events.prototype.updateWebhookValueWithSourceValue = function (wh, src) {
    src = src.event;

    wh.name = src.title + ' ' + src.id;
    wh.localist_title = src.title.trim();
    wh.localist_uid = src.id;
    wh.localist_venue_uid = src.venue_id || '';
    wh.localist_featured = src.featured || false;
    // localist_date_range_first
    // localist_date_range_last
    wh.localist_time_start =
        src.event_instances[0]
           .event_instance
           .start || '';
    wh.localist_time_end =
        src.event_instances[0]
           .event_instance
           .end || '';
    wh.localist_url = src.url || '';
    wh.localist_photo_url = src.photo_url || '';
    wh.localist_venue_url = src.venue_url || '';
    wh.localist_ticket_url = src.ticket_url || '';
    wh.localist_room_number = src.room_number || '';
    wh.localist_address = src.address || '';
    wh.localist_location_name = src.location_name || '';
    wh.localist_description_text = src.description_text || '';
    wh.localist_ticket_cost = src.ticket_cost || '';
    wh.localist_filters__department = (function (filters) {
            if ('departments' in filters) {
                return filters.departments.map(function (d) {
                    return { name: d.name };
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
            'localist_time_start',
            'localist_time_end'
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
};
