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
Events.prototype.webhookKey = function (row) {
    return row.localist_uid;
};
Events.prototype.sourceKey = function (row) {
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
        console.log('Events.getAllFromLocalist::end');
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

Events.prototype.firebaseIDFromSourceID = function (llUID) {
    if (!llUID) throw new Error('Requires Localist Unique ID.');
    var key   = [this.namespace, 'firebase', llUID];
    var start = key.concat([null]);
    var end   = key.concat([undefined]);

    return this._db.createReadStream({
            start: start,
            end: end,
            keys: true,
            values: false,
            limit: -1
        })
        .pipe(through.obj(firebaseKey));

    function firebaseKey (fbKey, enc, next) {
        if (fbKey.length !== 4) {
            var e = [
                'LevelDB for Firebase entries ',
                'should be at 4 in length. ',
                '["events", "firebase", llUID, fbUID]'
            ];
            throw new Error(e.join(''));
        }
        this.push(fbKey[3]);
        next();
    }
};

Events.prototype.listSourceKV = function (opts) {
    if (!opts) opts = {};
    return this._db.createReadStream({
        start: [this.namespace, 'localist', null ],
        end: [this.namespace, 'localist', undefined ],
        keys: opts.keys || true,
        values: opts.values || true,
        limit: -1
    });
};

Events.prototype.mapSourceToFirebase = function () {
    var events = this;
    /* Get a stream of localist keys and values.
       find the matching firebase key for
       that same localist id.
       */
    return through.obj(compare);

    function compare (localist, enc, next) {
        var llKey = localist.key;
        var llValue = localist.value;

        if (llKey.length !== 3) {
            var e = [
                'Expected stream of localist keys in ',
                'leveldb. The length should be 3, ',
                'given the following pattern. ',
                '["events", "localist", llUID]'
            ];
            throw new Error(e.join(''));
        }

        var row = {
            llUID: llKey[2],
            fbUID: false,
            llValue: llValue
        };

        var self = this;
        var d = events.firebaseIDFromSourceID(row.llUID);

        d.on('data', function (fbUID) {
            row.fbUID = fbUID;
        });
        d.on('end', function () {
            self.push(row);
            next();
        });
    }
};

Events.prototype.sourceValueToFirebaseValue = function (row) {
    var d = {
        name: row.title + ' ' + row.id,
        localist_title: row.title.trim(),
        localist_uid: row.id,
        localist_venuid_uid: row.venue_id,
        localist_featured: row.featured,
        // localist_date_range_first: 
        // localist_date_range_last: 
        localist_time_start: row.event_instances[0]
                       .event_instance
                       .start,
        localist_time_end: row.event_instances[0]
                     .event_instance
                     .end,
        localist_url: row.localist_url,
        localist_photo_url: row.photo_url,
        localist_venue_url: row.venue_url,
        localist_ticket_url: row.ticket_url,
        localist_room_number: row.room_number,
        localist_address: row.address,
        localist_location_name: row.location_name,
        localist_description_text: row.description_text,
        localist_ticket_cost: row.ticket_cost,
        localist_filters__department: (function (filters) {
            if ('departments' in filters) {
                return filters.departments.map(function (d) {
                    return { name: d.name };
                });
            } else {
                return [];
            }
            
        })(row.filters),
        localist_filters__event_types: (function (filters) {
            if ('event_types' in filters) {
                return filters.event_types.map(function (d) {
                    return { name: d.name };
                });
            } else {
                return [];
            }
        })(row.filters),
        is_draft: false
    };

    return (eventDateSort(
                whUtil.whRequiredDates(
                    d)));

    function eventDateSort (d) {
        var fields = [
            'time_end',
            'time_start'
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

Events.prototype.levelPrepPutFromSource = function () {
    var self = this;
    return through.obj(function (row, enc, next) {
        var key = [ self.namespace, 'localist', row.event.id ];
        this.push({
            key: key,
            value: row.event,
            type: 'put'
        });
        next();
    },
    function end () {
        console.log('Events.levelPrepPutFromLocalist::end');
        this.push(null);
    });
};

Events.prototype.levelPrepPutFromFirebase = function () {
    var self = this;
    return through.obj(function (row, enc, next) {
        var key = [ self.namespace, 'firebase', row.event.localist_uid, row.fbKey ];
        this.push({
            key: key,
            value: row.event,
            type: 'put'
        });
        next();
    });
};