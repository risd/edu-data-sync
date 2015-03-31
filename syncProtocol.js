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

function resolveRelationships () {
    var self = this;
    return through.obj(resolve);

    // expecting this to be pulling data
    // from listFirebaseWebhook
    // row.{webhook, whKey}

    // leans on the `relationshipsToResolve`
    // method being on the prototype to 
    // capture the data for the relationships
    function resolve (row, enc, next) {
        stream = this;
        var toResolve = self.relationshipsToResolve(row.webhook);

        /*
        - get firebase data for `relateToContentType`
        - loop through data, `relatedContentTypeData`
        - check to see if the data you are looping through
          equals any of the data you are trying to match
          against.
        - For every relationship, make its reverse
        - Save row.webhook
        - Save reverse related objects
         */
        
        var relationshipsToResolveCount = toResolve.length;
        var reverseRelationshipToSave = {};
        
        toResolve
            .forEach(function (resolve) {

                row.webhook[resolve.relationshipKey] = [];

                self._firebase
                    .webhook
                    .child(resolve.relateToContentType)
                    .once('value', onRelatedDataCaptureComplete);

                function onRelatedDataCaptureComplete (snapshot) {
                    var relatedContentTypeData = snapshot.val();

                    if (relatedContentTypeData) {
                        Object.keys(relatedContentTypeData)
                            .forEach(function (currentRelatedKey) {
                                var currentRelatedContentTypeData =
                                    relatedContentTypeData
                                            [currentRelatedKey];
                                var checkRelated =
                                        currentRelatedContentTypeData
                                            [resolve.relateToContentTypeDataUsingKey];

                                resolve.data.forEach(function (toMatch) {
                                    if (toMatch[resolve.relateToContentType] === checkRelated) {
                                        var relationship = [resolve.relateToContentType, currentRelatedKey].join(' ');
                                        var reverseKey = [self.webhookContentType, resolve.relationshipKey].join('_');
                                        var reverse = [self.webhookContentType, row.whKey].join(' ');

                                        // Check for relationship array
                                        if (!(resolve.relationshipKey in row.webhook)) {
                                            // Add it if its not there
                                            row.webhook[resolve.relationshipKey] = [];
                                        }
                                        // Check for relationship in array
                                        if (row.webhook[resolve.relationshipKey]
                                                .indexOf(relationship) === -1) {

                                            // Add it if its not there
                                            row.webhook[resolve.relationshipKey]
                                                .push(relationship);
                                        }

                                        // Check for reverse relationship array
                                        if (!(reverseKey in currentRelatedContentTypeData)) {
                                            // Add it if its not there
                                            currentRelatedContentTypeData
                                                [reverseKey] = [];
                                        }
                                        // Check for reverse relationship in array
                                        if (currentRelatedContentTypeData
                                                [reverseKey]
                                                .indexOf(reverse) === -1) {
                                            // Add it if its not there
                                            currentRelatedContentTypeData
                                                [reverseKey]
                                                .push(reverse);

                                            // Add this object to 
                                            reverseRelationshipToSave
                                                [currentRelatedKey] = currentRelatedContentTypeData;
                                        }
                                    }
                                });
                            });
                    } else {
                        var m = [
                            'Did not find data to relate.',
                            '\tmodel.prototype.resolveRelationships'
                        ];
                        throw new Error(m.join('\n'));
                    }

                    relationshipsToResolveCount -= 1;
                    if (relationshipsToResolveCount === 0) {
                        Save();
                    }
                    
                }
            });

        function Save () {
            var saversCount = 2;
            var savers = [SaveData(), SaveReverse()];
            savers.forEach(function (saver) {
                saver.on('data', function () {});
                saver.on('end', function () {
                    saversCount -= 1;
                    if (saversCount === 0) {
                        Done();
                    }
                });
            });

            function SaveData () {
                var t = through.obj();

                self._firebase
                    .webhook
                    .child(self.webhookContentType)
                    .child(row.whKey)
                    .set(row.webhook, onRelatedDataResolved);

                return t;

                function onRelatedDataResolved () {
                    t.push({});
                    t.push(null);
                }
            }

            function SaveReverse () {
                var t = through.obj();

                var toSaveKeys = Object.keys(reverseRelationshipToSave);
                var toSaveCount = toSaveKeys.length;
                
                toSaveKeys
                    .forEach(function (toSaveKey) {
                        var toSave = reverseRelationshipToSave[toSaveKey];
                        self._firebase
                            .webhook
                            .child(resolve.relateToContentType)
                            .child(toSaveKey)
                            .set(toSave, onSaved);

                        function onSaved () {
                            toSaveCount -= 1;
                            if (toSaveCount === 0) {
                                t.push({});
                                t.push(null);
                            }
                        }
                    });

                return t;
            }
        }

        function Done () {
            stream.push(row);
            next();
        }
    }
}
