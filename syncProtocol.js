/* Pass in a model, and modify it to get the common 
   functions necessary for sync, and consistent
   across any api/implementation */

var through = require('through2');
var combine = require('stream-combiner2');

module.exports = SyncProtocol;

function SyncProtocol (model, firebaseref) {
    model.prototype.listFirebaseWebhook = listFirebaseWebhook;
    model.prototype.listFirebaseSource = listFirebaseSource;
    model.prototype.addSourceToWebhook = addSourceToWebhook;
    model.prototype.sourceStreamToFirebaseSource = sourceStreamToFirebaseSource;

    var m = ['Model does not conform to Sync protocol.'];

    if (typeof model.prototype.webhookContentType !== 'string') {
        m.push('Requires webhookContentType string.');
    }
    if (typeof model.prototype.webhookKeyName !== 'string') {
        m.push('Requires webhookKeyName string.');
    }
    if (typeof model.prototype.keyFromSource !== 'function') {
        m.push('Requires keyFromSource method.');
    }
    if (typeof model.prototype.keyFromWebhook !== 'function') {
        m.push('Requires keyFromWebhook method.');
    }
    if (typeof model.prototype.updateWebhookValueWithSourceValue !== 'function') {
        m.push('Requires updateWebhookValueWithSourceValue method.');
    }
    if (typeof model.prototype.listSource !== 'function') {
        m.push('Requires getAllFromSource method.');
    }
    if (m.length !== 1) {
        throw new Error(m.join('\n'));
    }

    var type = model.prototype.webhookContentType;
    var webhookPath = 'data/' + type;
    var sourcePath = 'eduSync/' + type;

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
        .once('value', onData, onError);

    return eventStream;

    function onData (snapshot) {
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
    }

    function onError (error) {
        console.log('listFirebaseWebhook');
        console.log(error);
    }
}

function listFirebaseSource () {
    var self = this;

    var eventStream = through.obj();

    self._firebase
        .source
        .once('value', onData, onError);

    return eventStream;

    function onData (snapshot) {
        var values = snapshot.val();
        if (values) {
            Object
                .keys(values)
                .forEach(function (key) {
                    eventStream.push({
                        source: values[key],
                        srcKey: self.keyFromSource(values[key])
                    });
                });
        }
        eventStream.push(null);
    }

    function onError (error) {
        console.log('listFirebaseSource');
        console.log(error);   
    }
}

function addSourceToWebhook () {
    var self = this;
    var whData = false;

    return combine(
        through.obj(findWhKey),
        through.obj(updateWebhook));

    function findWhKey (row, enc, next) {
        var stream = this;

        if (whData === false) {
            self._firebase
                .webhook
                .once('value', onData, onError);
        } else {
            findKeyInWhData();
        }

        function findKeyInWhData () {
            row.webhook = {};
            row.whKey = undefined;
            Object
                .keys(whData)
                .forEach(function (key) {
                    if (whData[key][self.webhookKeyName] === row.srcKey) {
                        row.webhook = whData[key];
                        row.whKey = key;
                    }
                });
            stream.push(row);
            next();
        }

        function onData (snapshot) {
            whData = snapshot.val();
            if (whData === null) {
                whData = {};
            }
            findKeyInWhData();
        }

        function onError (error) {
            console.log('addSourceToWebhook');
            console.log(error);
        }
    }

    function updateWebhook (row, enc, next) {
        var stream = this;

        var ref;
        if (row.whKey) {
            ref = self._firebase
                      .webhook
                      .child(row.whKey);
        } else {
            ref = self._firebase
                      .webhook
                      .push();
        }

        var value =
            self.updateWebhookValueWithSourceValue(
                row.webhook,
                row.source);

        ref.set(value, onComplete);

        function onComplete (error) {
            if (error) {
                throw new Error(error);
            }
            row.updatedWebhook = value;
            stream.push(row);
            next();
        }
    }
}

function sourceStreamToFirebaseSource () {
    var self = this;
    return through.obj(toFirebase);

    function toFirebase (row, enc, next) {
        var stream = this;

        var key = self.keyFromSource(row);
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
