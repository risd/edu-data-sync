var from = require('from2-array');
var through = require('through2');

module.exports = FirebaseRef;


/*

Needs to reference .env, instead of rmConf & fbConf


 */

function FirebaseRef (opts) {
    if (!opts) reject();
    if (!opts.rmConf) reject();
    if (!opts.fbConf) reject();

    return from.obj([{}])
               .pipe(FirebaseToken(opts.rmConf))
               .pipe(FirebaseAuth())
               .pipe(FirebaseBucketForSite(opts.fbConf))
               .pipe(PushRef());
}

function FirebaseToken (config) {
    var request = require('request');
    var authUrl =
            'https://auth.firebase.com/auth/firebase';


    return through.obj(createToken);

    function createToken (row, enc, next) {
        var self = this;
        request(
            authUrl, {
                qs: {
                    email: config.email,
                    password: config.password,
                    firebase: config.firebase
                }
            },
            function (err, res, body) {
                var data = JSON.parse(body);
                self.push(data);
                next();
            });
    }
}

function FirebaseAuth () {
    var Firebase = require('firebase');
    var dbName = 'webhook';


    return through.obj(auth);

    function auth (row, enc, next) {
        
        var self = this;
        var firebase = new Firebase(
                            'https://' +
                            dbName +
                            '.firebaseio.com/');

        firebase
            .auth(
                row.token,
                function (error, auth) {
                    if (error) {
                        console.log(error);
                    } else {
                        self.push({
                            firebaseRoot: firebase
                        });
                    }
                    next();
                });
    }
}



function FirebaseBucketForSite (config) {
    var fs = require('fs');
    return through.obj(conf);

    function conf (row, enc, next) {
        row.firebase =
                row.firebaseRoot
                   .child(
                        'buckets/' +
                        config.siteName +
                        '/' +
                        config.secretKey +
                        '/dev');
        this.push(row);
        next();
    }
}

function PushRef () {
    return through.obj(ref);

    function ref (row, enc, next) {
        this.push(row.firebase);
        next();
    }

    // function end () {
    //     this.push(null);
    // }
}

function reject () {
     throw new Error('Requires configuration options');
}