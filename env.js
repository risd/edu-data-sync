var debug = require('debug')('env');
var fs = require('fs');

module.exports = Env;

/**
 * Env ensures that environment variables are set.
 *
 * The return value is an object that can be used
 * by the ./bin/herokuConfig process to push these
 * variables into the heroku app that will run
 * this sync process.
 */
function Env () {
    return [].concat(RISDMediaConfigToEnv(),
                     FirebaseConfigToEnv(),
                     AWStoEnv(),
                     Timezone(),
                     ElasticSearch());
}


function RISDMediaConfigToEnv () {
    debug('Reading RISD Media Config.');
    var fileName = __dirname + '/.risdmedia.conf';
    var rmConf;
    try {
        var file = fs.readFileSync(fileName);
        rmConf = JSON.parse(file.toString());
    } catch (err) {
        var e = [
            'Expecting .risdmedia.conf variables',
            'are already in process.env'
        ];
        debug(e.join(' '));
        return [];
    }

    // Validate the configuration.
    // These are required.
    var missing = [];
    if (!('wh' in rmConf)) {
        missing.push('wh');
    } else {
        if (!('email' in rmConf.wh)) {
            missing.push('wh.email');
        }
        if (!('password' in rmConf.wh)) {
            missing.push('wh.password');
        }
        if (!('firebase' in rmConf.wh)) {
            missing.push('wh.firebase');
        }
        if (!('apikey' in rmConf.wh)) {
            missing.push('wh.apikey');
        }
    }
    if (!('tumblr' in rmConf)) {
        missing.push('tumblr');
    } else {
        if (!('consumer_key' in rmConf.tumblr)) {
            missing.push('tumblr.consumer_key');
        }
        if (!('consumer_secret' in rmConf.tumblr)) {
            missing.push('tumblr.consumer_secret');
        }
    }

    if (missing.length > 0) {
        var e = [
            'Running deploy requries the ',
            'following values to be in your ',
            '`.risdmedia.conf` file.\n',
            missing.join(', '),
            '\n\n'
        ];
        throw new Error(e.join(''));
    }

    // Set env for local running
    process.env.WH_EMAIL = rmConf.wh.email;
    process.env.WH_PASSWORD = rmConf.wh.password;
    process.env.WH_APIKEY = rmConf.wh.apikey;
    process.env.WH_FIREBASE = rmConf.wh.firebase;
    process.env.TUMBLR_CONSUMER_KEY =
        rmConf.tumblr.consumer_key;
    process.env.TUMBLR_CONSUMER_SECRET =
        rmConf.tumblr.consumer_secret;

    debug('rmConf.wh', JSON.stringify(rmConf.wh));

    // Return strings that can be used
    // to set heroku config
    return [
        'WH_EMAIL=' + rmConf.wh.email,
        'WH_PASSWORD=' + rmConf.wh.password,
        'WH_FIREBASE=' + rmConf.wh.firebase,
        'WH_APIKEY=' + rmConf.wh.apikey,
        'TUMBLR_CONSUMER_KEY=' + rmConf.tumblr.consumer_key,
        'TUMBLR_CONSUMER_SECRET=' +
                rmConf.tumblr.consumer_secret
    ];
}

function FirebaseConfigToEnv () {
    debug('Reading Firebase Config.');
    var fileName = __dirname +  '/.firebase.conf';

    var fbConf;
    try {
        var file = fs.readFileSync(fileName);
        fbConf = JSON.parse(file.toString());
    } catch (err) {
        var e = [
            'Expecting .risdmedia.conf variables',
            'are already in process.env'
        ];
        debug(e.join(' '));
        return [];
    }

    process.env.FB_SECRET = fbConf.secretKey;
    process.env.FB_SITENAME = fbConf.siteName;

    return [
        'FB_SECRET=' + fbConf.secretKey,
        'FB_SITENAME=' + fbConf.siteName
    ];
}

function AWStoEnv () {
    debug('Reading AWS Config.');
    var fileName = process.env.HOME + '/.risdmedia/aws.json';

    var awsConf;
    try {
        var file = fs.readFileSync(fileName);
        awsConf = JSON.parse(file.toString());
    } catch (err) {
        var e = [
            'Expecting ~/.risdmedia/aws.json.',
            'Variables are expected already be',
            'in process.env'
        ];
        debug(e.join(' '));
        return [];
    }

    process.env.AWS_KEY = awsConf.key;
    process.env.AWS_SECRET = awsConf.secret;

    return [
        'AWS_KEY=' + awsConf.key,
        'AWS_SECRET=' + awsConf.secret
    ];
}

function Timezone () {
    debug('Timezone');

    var tz = "America/New_York";
    process.env.TZ = tz;

    return ['TZ=' + tz];
}

function ElasticSearch () {
    debug('ElasticSearch config.');

    var elasticSearchConf;
    try {
        var file = fs.readFileSync('.elastic-search.conf');
        elasticSearchConf = JSON.parse(file.toString());
    } catch (err) {
        var e = [
            'Expecting .elastic-search.conf.',
            'Variables must be in process.env already'
        ];
        debug(e.join(' '));
        return [];
    }

    process.env.ELASTIC_SEARCH_SERVER =
        elasticSearchConf.ELASTIC_SEARCH_SERVER;
    process.env.ELASTIC_SEARCH_USER =
        elasticSearchConf.ELASTIC_SEARCH_USER;
    process.env.ELASTIC_SEARCH_PASSWORD =
        elasticSearchConf.ELASTIC_SEARCH_PASSWORD;

    process.env.ELASTIC_SEARCH_INDEX = elasticSearchConf.ELASTIC_SEARCH_INDEX;

    process.env.FIREBASE_PROJECT = elasticSearchConf.FIREBASE_PROJECT;
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify(elasticSearchConf.FIREBASE_SERVICE_ACCOUNT);
    process.env.WORKER_CONCURRENCY = elasticSearchConf.WORKER_CONCURRENCY;

    return [
        'ELASTIC_SEARCH_SERVER=' + process.env.ELASTIC_SEARCH_SERVER,
        'ELASTIC_SEARCH_USER=' + process.env.ELASTIC_SEARCH_USER,
        'ELASTIC_SEARCH_PASSWORD=' + process.env.ELASTIC_SEARCH_PASSWORD,
        'ELASTIC_SEARCH_INDEX=' + process.env.ELASTIC_SEARCH_INDEX,
        'FIREBASE_PROJECT=' + process.env.FIREBASE_PROJECT,
        'FIREBASE_SERVICE_ACCOUNT=' + process.env.FIREBASE_SERVICE_ACCOUNT,
        'WORKER_CONCURRENCY=' + process.env.WORKER_CONCURRENCY,
    ];
}
