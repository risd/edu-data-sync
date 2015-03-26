/* Pass in a model, and modify it to get the common 
   functions necessary for sync, and consistent
   across any api/implementation */

var through = require('through2');
var combine = require('stream-combiner2');

module.exports = SyncProtocol;

function SyncProtocol (model, firebaseref) {
    model.prototype.listFirebaseWebhook = listFirebaseWebhook;
    model.prototype.compareWebhookToSource = compareWebhookToSource;
    model.prototype.updateFirebase = updateFirebase;

    model.prototype.sourceStreamToFirebaseSource = sourceStreamToFirebaseSource;

    var m = ['model does not conform to Sync protocol.'];

    if (typeof model.prototype.webhookContentType !== 'string') {
        m.push('Requires webhookContentType string.');
        throw new Error(m.join(''));
    }
    if (typeof model.prototype.listSource !== 'function') {
        m.push('Requires getAllFromSource method.');
    }
    if (typeof model.prototype.sourceKey !== 'function') {
        m.push('Requires sourceKey method.');
    }
    if (m.length !== 1) {
        // throw new Error(m.join('\n'));
        throw new Error('err');
    }

    var type = model.prototype.webhookContentType;
    var webhookPath = 'data/' + type;
    var sourcePath = 'eduSync/' + type;

    firebaseref.child('eduSync').set({});

    model.prototype._firebase = {
        webhook: firebaseref.child(webhookPath),
        source:  firebaseref.child(sourcePath)
    };
}

function listFirebaseWebhook () {
    var self = this;

    var eventStream = through.obj();

    self._firebase
        .webhook
        .once(
            'value',
            function (snapshot) {
                var values = snapshot.val();
                if (values) {
                    Object
                        .keys(values)
                        .forEach(function (key) {
                            eventStream.push({
                                webhook: values[key],
                                whKey: key
                            });
                        });
                }
                eventStream.push(null);
            },
            function (error) {
                console.log(
                    '!model type!fix to reflect model!' +
                    '.getAllFromFirebase::error');
                console.log(error);
            });

    return eventStream;
}

function compareWebhookToSource () {
    var self = this;
    return combine(
            through.obj(addSync),
            through.obj(compare));

    function addSync (row, enc, next) {
        var stream = this;

        var srcKey = self.webhookKey(row.webhook);
        row.srcKey = srcKey;

        console.log(srcKey);

        self._firebase
            .source
            .child(srcKey)
            .once(
                'value',
                function (snapshot) {
                    row.source = snapshot.val();
                    stream.push(row);
                    next();
                },
                function (error) {
                    console.log('compareWebhookToSync');
                    console.log(error);
                });
    }

    function compare (row, enc, next) {
        if (row.source) {
            console.log(2);
        } else {
            console.log(1);
        }
        this.push(row);
        next();
    }
}

function updateFirebase () {
    var self = this;

    return through.obj(update);

    function update (row, enc, next) {

        var fbValue =
            self.sourceValueToFirebaseValue(
                    row.llValue);

        var fbRef;
        if (row.fbUID === false) {
            // write to firebase
            console.log('Set on firebase');
            fbRef = self._firebase.push();
        } else {
            // update firebase
            console.log('Update on firebase');
            fbRef = self._firebase.child(row.fbUID);
        }

        var stream = this;
        fbRef.set(fbValue, function cmplt (error) {
            if (error) {
                var e = [
                    'Error writing to value to firebase. ',
                    'Put this value back into some kind ',
                    'of loop that will ensure this goes ',
                    'through?'
                ];
                throw new Error(e.join(''));
            }
            stream.push(row);
            next();
        });
    }
}

function sourceStreamToFirebaseSource () {
    var self = this;
    return through.obj(toFirebase);

    function toFirebase (row, enc, next) {
        var stream = this;

        var key = self.sourceKey(row);
        self._firebase
            .source
            .child(key)
            .set(row, onComplete);

        function onComplete () {
            stream.push(row);
            next();
        }
    }
}
