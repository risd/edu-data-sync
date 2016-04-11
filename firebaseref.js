var debug = require('debug')('firebaseref');
var from = require('from2-array');
var pump = require('pump');
var through = require('through2');

module.exports = FirebaseRef;

/**
 * FirebaseRef
 * 
 * Returns object stream that pushes a
 * firebase object that has been configured
 * for the current WebHook site.
 *
 * WebHook configuration is depends on
 * these environment variables to be set.
 *
 * process.env.WH_EMAIL
 * process.env.WH_PASSWORD
 * process.env.WH_FIREBASE
 * process.env.FB_SITENAME
 * process.env.FB_SECRET
 * 
 */

function FirebaseRef (callback) {
    debug('Initialize stream');
    var args = [
        from.obj([{}]),
        FirebaseToken(),
        FirebaseAuth(),
        FirebaseBucketForSite(),
        PushRef(callback)];

    return pump.apply(this, args);
}

function FirebaseToken () {
    var request = require('request');
    var authUrl =
            'https://auth.firebase.com/auth/firebase';


    return through.obj(createToken);

    function createToken (row, enc, next) {
        debug('Create token');
        var self = this;
        var qs = {
            email: process.env.WH_EMAIL,
            password: process.env.WH_PASSWORD,
            firebase: process.env.WH_FIREBASE
        };

        request(
            authUrl,
            { qs: qs },
            function (err, res, body) {
                if (err) self.push(err, null);
                else self.push(JSON.parse(body));
                next();
            });
    }
}

function FirebaseAuth () {
    var Firebase = require('firebase');
    var dbName = 'webhook';


    return through.obj(auth);

    function auth (row, enc, next) {
        debug('Authenticate');
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
                        self.push(error, null);
                    } else {
                        self.push({
                            firebaseRoot: firebase
                        });
                    }
                    next();
                });
    }
}

function FirebaseBucketForSite () {
    var fs = require('fs');
    return through.obj(conf);

    function conf (row, enc, next) {

        row.firebase =
                row.firebaseRoot
                   .child(
                        'buckets/' +
                        process.env.FB_SITENAME +
                        '/' +
                        process.env.FB_SECRET +
                        '/dev');

        this.push(row);
        next();
    }
}

function PushRef (callback) {
    return through.obj(ref);

    function ref (row, enc, next) {
        if (callback) {
            callback(null, row.firebase);
        }
        else {
            this.push(row.firebase);
        }
        this.push(null);
        next();
    }
}
