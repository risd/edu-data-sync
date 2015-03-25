var fs = require('fs');

module.exports = Env;

function Env () {
	RISDMediaConfigToEnv();
	FirebaseConfigToEnv();
}


function RISDMediaConfigToEnv () {
    console.log('Reading RISD Media Config.');
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
        console.log(e.join(' '));
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
    process.env.WH_FIREBASE = rmConf.wh.firebase;

    // Return strings that can be used
    // to set heroku config
    return [
        'WH_EMAIL=' + rmConf.wh.email,
        'WH_PASSWORD=' + rmConf.wh.password,
        'WH_FIREBASE=' + rmConf.wh.firebase
    ];
}

function FirebaseConfigToEnv () {
    console.log('Reading Firebase Config.');
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
        console.log(e.join(' '));
        return [];
    }

    process.env.FB_SECRET = fbConf.secretKey;
    process.env.FB_SITENAME = fbConf.siteName;

    return [
        'FB_SECRET=' + fbConf.secretKey,
        'FB_SITENAME=' + fbConf.siteName
    ];
}
