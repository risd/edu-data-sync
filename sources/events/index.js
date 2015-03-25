// powered by localist

var request = require('request');
var moment = require('moment');
var through = require('through2');

var local = require('../localStore.js')
                   ({
                       dbPath: process.cwd() +
                               '/data/.db',
                       fresh: true
                   });


var fs = require('fs');
var fbConf = require('../util.js').FirebaseConfig();
var rmConf = require('../util.js').RISDMediaConfig();
var cloud = require('../cloudStore.js')
                   ({
                        rmConf: rmConf.wh,
                        fbConf: fbConf
                   });

var util = require('../util.js');


var Events = require('./model.js')();
var firebaseConfig = Events.firebaseRefStream();
var leveldbConfig = Events.leveldbRefStream();

var storeConfig = StoreConfigure([
                        firebaseConfig,
                        leveldbConfig
                    ]);

cloud.pipe(firebaseConfig);
local.pipe(leveldbConfig);

// Events is a stream that pushes the full configured
// Events prototype. Pipe it into any other actions
// You want that depend on having had configured
// events for localist levedb and firebase.

storeConfig.on('data', function (events) {
    console.log('Events Configured.');

    externalToLevel(events)
        .pipe(util.loggify())
        .pipe(compareLocalAndUpdateFirebase(events))
        .pipe(util.loggify());
});


function compareLocalAndUpdateFirebase (events) {
    return through.obj(compare);

    function compare (row, enc, next) {

        console.log('Compare data locally.');

        var self = this;
        events.listLocalistKV()
            .pipe(events.mapLocalistToFirebase())
            .pipe(events.updateFirebase())
            .pipe(waitEnd(function endcb () {
                var m = [
                    'Done doing local diff and update'
                ];
                self.push({ msg: m.join('') });
                self.push(null);
            }));
    }

    function waitEnd (cb) {
        return through.obj(wait, end);

        function wait (row, enc, next) {
            next();
        }
        function end () {
            this.push(null);
            cb();
        }
    }
}

function externalToLevel (events) {
    console.log('Bring External Data into LevelDB');
    var t = through.obj();

    var l = localistToLevel(events);
    var f = firebaseToLevel(events);

    var expected = ['localist', 'firebase'];
    var onend = Done(expected, function () {
        var m = [
            'Done importing into LevelDB for ',
            'local diffing'
        ];
        t.push({ msg: m.join('') });
        t.push(null);
    });

    l.pipe(util.pull());
    f.pipe(util.pull());

    l.on('end', onend);
    f.on('end', onend);

    return t;


    function localistToLevel (events) {
        console.log('Localist > LevelDB');
        var t = through.obj();
        var batchWrite = batchor(events._db);
        batchWrite.pipe(util.pull());

        batchWrite.on('end', function () {
            var m = [
                'Localist > LeveDB :: end'
            ];
            t.push({ msg: m.join('') });
            t.push(null);
        });

        events.getAllFromLocalist()
            .pipe(events.levelPrepPutFromLocalist())
            .pipe(throttleGroup(20))
            .pipe(batchWrite);

        return t;
    }

    function firebaseToLevel (events) {
        console.log('Firebase > LevelDB');
        var t = through.obj();
        var batchWrite = batchor(events._db);
        batchWrite.pipe(util.pull());

        batchWrite.on('end', function () {
            var m = [
                'Firebase > LeveDB :: end'
            ];
            t.push({ msg: m.join('') });
            t.push(null);
        });

        events.getAllFromFirebase()
            .pipe(events.levelPrepPutFromFirebase())
            .pipe(throttleGroup(20))
            .pipe(batchWrite);

        return t;
    }

    function Done(expected, cb) {
        return function () {
            expected.pop();
            if (expected.length === 0) {
                if (cb) {
                    cb();
                }
            }
        };
    }
}



function throttleGroup (count) {
    var q = [];

    return through.obj(write, end);

    function write (row, enc, next) {
        if (q.length < count) {
            q.push(row);
        } else {
            this.push(q.splice(0));
            q.push(row);
        }
        next();
    }

    function end () {
        // console.log('throttleGroup::end');
        this.push(q.slice(0));
        this.push(null);
    }
}


function batchor (db) {
    var errors = [];
    return through.obj(write, end);

    function write (row, enc, next) {
        var self = this;

        db.batch(row, function (err) {
            if (err) errors.push(err);
            next();
        });
    }

    function end () {
        // console.log('batchor::end');
        this.push(null);
    }
}

// function FirebaseConfig (fs) {
//     console.log('Reading Firebase Config.');
//     var fileName = process.cwd() + '/.firebase.conf';
//     var fbConf = JSON.parse(
//                    fs.readFileSync(fileName)
//                      .toString()
//                    );
//     return fbConf;
// }

// function RISDMediaConfig (fs) {
//     console.log('Reading RISD Media Config.');
//     var fileName = process.cwd() + '/.risdmedia.conf';
//     var rmConf;
//     try {
//         rmConf = JSON.parse(
//                         fs.readFileSync(fileName)
//                           .toString()
//                         );
//     } catch (err) {
//         var e = [
//             'Running deploy requries ',
//             'a `.risdmedia.conf` file to ',
//             'reside at the root of your ',
//             'project directory. This should ',
//             'be a valid json file.'
//         ];
//         throw new Error(e.join(''));
//     }

//     // Validate the configuration.
//     // These are required.
//     var missing = [];
//     if (!('wh' in rmConf)) {
//         missing.push('wh');
//     } else {
//         if (!('email' in rmConf.wh)) {
//             missing.push('wh.email');
//         }
//         if (!('password' in rmConf.wh)) {
//             missing.push('wh.password');
//         }
//         if (!('firebase' in rmConf.wh)) {
//             missing.push('wh.firebase');
//         }
//     }
//     if (!('aws' in rmConf)) {
//         missing.push('aws');
//     } else {
//         if (!('key' in rmConf.aws)) {
//             missing.push('aws.key');
//         }
//         if (!('secret' in rmConf.aws)) {
//             missing.push('aws.secret');
//         }
//     }
//     if (!('project' in rmConf)) {
//         missing.push('project');
//     }

//     if (missing.length > 0) {
//         var e = [
//             'Running deploy requries the ',
//             'following values to be in your ',
//             '`.risdmedia.conf` file.\n',
//             missing.join(', ')
//         ];
//         throw new Error(e.join(''));
//     }

//     return rmConf;
// }

function StoreConfigure (toWatch) {
    var watching = toWatch.map(function (d, i) { return i; });
    var t = through.obj();
    var configured;

    toWatch.forEach(function (w, i) {
        w.on('data', function (d) {
            configured = d;
        });

        w.on('end', function () {
            watching.pop();

            if (watching.length === 0) {
                t.push(configured);
                t.push(null);
            }
        });
    });

    return t;
}