/* Pass in a model, and modify it to get the common 
   functions necessary for sync, and consistent
   across any api/implementation */

var from = require('from2-array');
var through = require('through2');
var combine = require('stream-combiner2');

module.exports = SyncProtocol;

function SyncProtocol (model, firebaseref) {
    model.prototype.listFirebaseWebhook = listFirebaseWebhook;
    model.prototype.listFirebaseSource = listFirebaseSource;
    model.prototype.addSourceToWebhook = addSourceToWebhook;
    model.prototype.resolveRelationships = resolveRelationships;

    if (typeof model.prototype.sourceStreamToFirebaseSource === 'undefined') {
        model.prototype.sourceStreamToFirebaseSource = sourceStreamToFirebaseSource;
    }

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
    if (typeof model.prototype.relationshipsToResolve !== 'function') {
        m.push('Requires relationshipsToResolve method.');
    }
    if (m.length !== 1) {
        throw new Error(m.join('\n'));
    }

    var type = model.prototype.webhookContentType;
    var webhookDataRoot = 'data';
    var webhookPath = 'data/' + type;
    var sourcePath = 'eduSync/' + type;

    model.prototype._firebase = {
        webhook: firebaseref.child(webhookPath),
        source:  firebaseref.child(sourcePath),
        webhookDataRoot: firebaseref.child(webhookDataRoot)
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

function resolveRelationships () {
    var self = this;
    // flatten this into a series of through
    // streams piped here? rather than
    // resolve holding onto the entire stack.
    return through.obj(resolve);

    // expecting this to be pulling data
    // from listFirebaseWebhook
    // row.{webhook, whKey}

    // leans on the `relationshipsToResolve`
    // method being on the prototype to 
    // capture the data for the relationships
    function resolve (row, enc, next) {
        console.log("Resolving relationship.");
        stream = this;

        var toResolveArr = self.relationshipsToResolve(row.webhook);

        row.updated = false;

        var resolver =
            from.obj(toResolveArr)
                .pipe(through.obj(getRelatedData, end));

        resolver.on('data', function () {});
        resolver.on('end', function () {
            stream.push(row);
            next();
        });
    }

    function getRelatedData (toResolve, enc, next) {
        console.log('Get related data');
        toResolve.relatedData = false;

        if (toResolve.itemsToRelate.length === 0) {
            console.log('No relationships to make.');
            this.push(toResolve);
            next();
        } else {
            var maker = this;
            var w = relatedDataStream(toResolve)
                .pipe(populateRelated(toResolve))
                .pipe(saveReverse())
                .pipe(saveCurrent(toResolve));

            w.on('data', function () {});
            w.on('end', function () {
                maker.push(toResolve);
                next();
            });
        }
    }

    function end () { this.push(null); }

    function relatedDataStream (toResolve) {
        /*
        Get data for the related content type
        and push keys and values as individual
        objects into the stream.
         */
        var t = through.obj();

        self._firebase
                .webhookDataRoot
                .child(toResolve.relateToContentType)
                .once('value', function onComplete (snapshot) {
                    var keysAndValuesObj = snapshot.val();
                    if (keysAndValuesObj) {
                        Object.keys(keysAndValuesObj)
                            .forEach(function (key) {
                                var value = keysAndValuesObj[key];
                                t.push({
                                    key: key,
                                    value: value
                                });
                            });
                    }
                    t.push(null);
                });
        
        return t;   
    }

    function populateRelated (toResolve) {
        /*
        Expected related.{key, value}
        Pushes any an object with key, value
        pairs to save.

        { currentContentTypeData: [],
          relatedContentTypeData: []  }

        currentData.length === 1
        relatedData.length === N

         */

        return through.obj(populate);

        function populate (related, enc, next) {
            related.updated = false;
            toResolve
                .itemsToRelate
                .forEach(function (itemToRelate) {
                    var relate =
                        itemToRelate
                            [toResolve.relateToContentType];
                    var related =
                        related
                            .value[toResolve
                                .relateToContentTypeDataUsingKey];

                    if (relate === related) {
                        console.log('Match!');
                        var relationshipValue = [
                                toResolve.relateToContentType,
                                related.key
                            ]
                            .join(' ');

                        var revsereKey = [
                                self.webhookContentType,
                                toResolve.relationshipKey
                            ]
                            .join('_');

                        var reverseValue = [
                                self.webhookContentType,
                                row.whKey
                            ]
                            .join(' ');

                        if (!(toResolve.relationshipKey in row.webhook)) {
                            row.webhook[toResolve.relationshipKey] = [];
                        }
                        if (row.webhook[toResolve.relationshipKey]
                                .indexOf(relationshipValue) === -1) {

                            row.webhook[toResolve.relationshipKey]
                                .push(relationshipValue);
                            row.updated = true;
                        }

                        if (!(revsereKey in related.value)) {
                            related.value[revsereKey] = [];
                        }
                        if (related.value[revsereKey]
                                .indexOf(reverseValue) === -1) {
                            related[revsereKey].push(reverseValue);
                            related.updated = true;
                        }
                    }
                });
            
            this.push(related);
            next();
        }
    }

    function saveReverse (toResolve) {
        /*
        Expects related.{key, value}
        save these to their original location.
        These are used to set the current object,
        so only when all of these are done saving,
        should the next step in the stream be done.
         */
        
        return through.obj(save, push);

        function save (related, enc, next) {
            if (related.updated) {
                console.log('Save Reverse.');
                self._firebase
                    .webhookDataRoot
                    .child(toResolve.relateToContentType)
                    .child(related.key)
                    .set(related.value, function saved () {
                        next();
                    });
            } else {
                next();
            }
        }

        function push () {
            this.push({});
            this.push(null);
        }
    }

    function saveCurrent () {
        return through.obj(save);

        function save (notifier, enc, next) {
            if (row.updated) {
                var saver = this;
                console.log('Save object.');
                self._firebase
                    .webhook
                    .child(self.webhookContentType)
                    .child(row.whKey)
                    .set(row.webhook, function saved () {
                        saver.push({});
                        saver.push(null);
                    });
            } else {
                this.push({});
                this.push(null);
            }
        }
    }
}
