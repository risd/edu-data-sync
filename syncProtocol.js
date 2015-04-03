/* Pass in a model, and modify it to get the common 
   functions necessary for sync, and consistent
   across any api/implementation */

var from = require('from2-array');
var through = require('through2');
var combine = require('stream-combiner2');

module.exports = SyncProtocol;

function SyncProtocol (model, firebaseref) {

    var m = ['Model does not conform to Sync protocol.'];


    model.prototype.listFirebaseWebhook = listFirebaseWebhook;
    model.prototype.listFirebaseSource = listFirebaseSource;
    model.prototype.addSourceToWebhook = addSourceToWebhook;
    model.prototype.addInSourceBool = addInSourceBool;

    // Resolve relationship pipeline - Start
    model.prototype.rrAddRelationshipsToResolve =
        rrAddRelationshipsToResolve;
    model.prototype.rrGetRelatedData = rrGetRelatedData;
    model.prototype.rrPopulateRelated = rrPopulateRelated;
    model.prototype.rrSaveReverse = rrSaveReverse;
    model.prototype.rrSaveCurrent = rrSaveCurrent;

    if (typeof model.prototype.relationshipsToResolve !== 'function') {
        m.push('Requires relationshipsToResolve method.');
    }
    // Resolve relationship pipeline - End


    // Defaults for overwrittable methods - Start
    if (typeof model.prototype.sourceStreamToFirebaseSource === 'undefined') {
        model.prototype.sourceStreamToFirebaseSource = sourceStreamToFirebaseSource;
    }
    if (typeof model.prototype.updateWebhookValueNotInSource === 'undefined') {
        model.prototype.updateWebhookValueNotInSource = updateWebhookValueNotInSource;
    }
    // Defaults for overwrittable methods - End */
    

    if (typeof model.prototype.webhookContentType !== 'string') {
        m.push('Requires webhookContentType string.');
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


/**
 * `addSourceToWebhook` is a transform stream.
 * It expects a row of the source key and data.
 * `row.{srcKey, source}`.
 *
 * A snapshot of the current webhook data is
 * captured once to compare against the incoming
 * source data against.
 *
 * In `findKeyInWhData`, the key of every `webhook`
 * entry is compared to the `source` entry that
 * was originally passed through the stream. When
 * a match is found, the `webhook` data is added
 * to the `row`. Coming out of this function will
 * be `row.{srcKey, source, whKey, webhook}`.
 *
 * In `updateWebhook`, the source value,
 * `row.source`, is used to update the webhook
 * value, `row.webhook`. This is a done using
 * the `updateWebhookValueWithSourceValue`
 * defined on the source model prototype. The
 * updated `row.webhook` value is then saved
 * to the key defined by `row.whKey`, if one
 * was found, or a new key is made using the
 * firebase `push` method.
 *
 * This stream pushes the updated `webhook`
 * as part of the `row`.
 * `row.{srcKey, source, whKey, webhook}`
 *
 * @return through.obj stream
 */
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
                    if (self.keyFromWebhook(whData[key]) === row.srcKey) {
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
            row.webhook = value;
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


/**
 * `addInSourceBool` is a transform stream.
 * Expects `row.{whKey, webhook}`. A local
 * copy of the `self._firebase.source` will
 * be stashed in a local `sourceData` variable.
 * Each of the `webhook` values will be
 * compared to the `sourceData` values.
 * Incoming `webhook` values that are not
 * in the `sourceData` array will be flagged
 * using `row.inSource`. This will be a boolean
 * value. `true` for in source, `false for not.
 *
 * This stream will push `row` like this:
 * `row.{whKey, webhook, inSource}`
 * 
 * @return through.obj stream
 */
function addInSourceBool () {
    var self = this;
    var srcData = false;
    
    return through.obj(adder);

    function adder (row, enc, next) {
        var stream = this;

        if (srcData === false) {
            self._firebase
                .source
                .once('value', onData, onError);
        } else {
            findKeyInSrcDataAndMark();
        }

        function onData (snapshot) {
            srcData = snapshot.val();
            if (srcData === null) {
                srcData = {};
            }
            findKeyInSrcDataAndMark();
        }

        function onError (error) {
            console.log('addInSourceBool');
            console.log(error);
        }

        function findKeyInSrcDataAndMark () {
            row.inSource = false;
            Object
                .keys(srcData)
                .forEach(function (srcKey) {
                    if (self.keyFromSource(srcData[key]) ===
                        self.keyFromWebhook(row.webhook)) {

                        row.inSource = true;
                    }
                });
            stream.push(row);
            next();
        }
    }
}

/**
 * `updateWebhookValueNotInSource` default method
 * is to remove any `webhook` value that is not
 * represented as a `source` value.
 *
 * Expects `row.inSource` a boolean value.
 * If false, the `webhook` value is not represented
 * in the source values.
 *
 * This is default, which removes the entry.
 * This can be overwritten per model.
 * 
 * @return through.obj stream
 */
function updateWebhookValueNotInSource () {
    var self = this;
    return through.obj(updateNotInSource);

    function updateNotInSource (row, enc, next) {
        var stream = this;
        if (row.inSource === false) {
            console.log('Not in source. Remove.');
            self._firebase
                .webhook
                .child(row.whKey)
                .remove(function onComplete () {
                    row.whKey = undefined;
                    row.webhook = undefined;
                    stream.push(row);
                    next();
                });
        } else {
            this.push(row);
            next();
        }
    }
}


/* relationship resolution - rr */

function rrAddRelationshipsToResolve () {
    var self = this;
    return through.obj(resolve);

    /*
      expecting this to be pulling data
      from listFirebaseWebhook
      row.{webhook, whKey}
  
      push row.{webhook, whKey, updated, toResolve}
      for every relationship that needs to get
      resolved.
      if there are two relationships, two objects
      get pushed
      before saving, merge the items back together.
     */
    function resolve (row, enc, next) {
        row.updated = false;
        var toResolveArr = self.relationshipsToResolve(row.webhook);

        var stream = this;
        toResolveArr.forEach(function (toResolve) {
            row.toResolve = toResolve;
            stream.push(row);
        });
        next();
    }
}

function rrGetRelatedData () {
    var self = this;

    return through.obj(get);

    function get (row, enc, next) {
        // console.log('Get related data');
        row.relatedDataCollection = false;
        var stream = this;

        if (row.toResolve.itemsToRelate.length === 0) {
            // console.log('No relationships to make.');
            this.push(row);
            next();
        } else {
            self._firebase
                .webhookDataRoot
                .child(row.toResolve.relateToContentType)
                .once('value', function (snapshot) {
                    row.relatedDataCollection = snapshot.val();
                    stream.push(row);
                    next();
                });
        }
    }
}

function rrPopulateRelated () {
    var self = this;

    // If something is getting updated, it will
    // likely occur here.
    return through.obj(populate);

    function populate (row, enc, next) {
        // console.log('rrPopulateRelated');
        row.reverseToSave = false;

        if (row.relatedDataCollection) {
            row.reverseToSave = {};
            Object
                .keys(row.relatedDataCollection)
                .forEach(function (relatedKey) {
                    var relatedValue = row.relatedDataCollection[relatedKey];
                    var related =
                        relatedValue
                            [row.toResolve
                                .relateToContentTypeDataUsingKey];

                    // console.log(related);
                    row.toResolve
                        .itemsToRelate
                        .forEach(function (itemToRelate) {
                            var relate =
                                itemToRelate
                                    [row.toResolve
                                        .relateToContentType];

                            // console.log(relate);
                            if (related === relate) {
                                console.log('Match!');
                                // sort out updating objects

                                var relationshipKey =
                                    row.toResolve.relationshipKey;

                                if (!(relationshipKey in row.webhook)) {

                                    row.webhook
                                        [relationshipKey] = [];
                                }

                                var relationshipValue = [
                                        row.toResolve.relateToContentType,
                                        relatedKey
                                    ].join(' ');

                                if (row.webhook
                                        [relationshipKey]
                                            .indexOf(relationshipValue) === -1) {

                                    row.updated = true;
                                    row.webhook
                                        [relationshipKey]
                                                .push(relationshipValue);
                                }

                                var reverseKey = [
                                        self.webhookContentType,
                                        row.toResolve.relationshipKey
                                    ].join('_');

                                if (!(reverseKey in relatedValue)) {
                                    relatedValue[reverseKey] = [];
                                }

                                var reverseValue = [
                                        self.webhookContentType,
                                        row.whKey
                                    ].join(' ');

                                if (relatedValue[reverseKey]
                                        .indexOf(reverseValue) === -1) {
                                    relatedValue[reverseKey].push(reverseValue);
                                    row.reverseToSave[relatedKey] = relatedValue;
                                }
                            }
                        });
                });

            this.push(row);
            next();
        } else {
            this.push(row);
            next();
        }
    }
}

function rrSaveReverse () {
    var self = this;

    return through.obj(save);

    function save (row, enc, next) {
        var stream = this;

        if (row.reverseToSave) {
            var saverKeys = Object.keys(row.reverseToSave);
            var saversCount = saverKeys.length;
            console.log('Save reverse.');
            console.log(saversCount);
            if (saversCount === 0) {
                this.push(row);
                next();
            } else {
                var savers =
                    saverKeys
                        .map(function (reverseKey) {
                            return saver(reverseKey,
                                         row.reverseToSave[reverseKey]);
                        });

                savers.forEach(function (s) {
                    s.on('data', function () {});
                    s.on('end', function () {
                        saversCount -= 1;
                        if (saversCount === 0) {
                            console.log('Save reverse::done');
                            stream.push(row);
                            next();
                        }
                    });
                });
            }
        } else {
            console.log('Do not save reverse.');
            this.push(row);
            next();
        }

        function saver (key, value) {
            var t = through.obj();
            console.log('saver');
            console.log(key);
            console.log(value);
            self._firebase
                .webhookDataRoot
                .child(row.toResolve.relateToContentType)
                .child(key)
                .set(value, function () {
                    t.push({});
                    t.push(null);
                });

            return t;
        }
    }
}

function rrSaveCurrent () {
    var self = this;

    var current = {
        whKey: false,
        toMerge: []
    };
    return through.obj(save);

    function save (row, enc, next) {
        var stream = this;
        if (current.whKey === false) {
            // first time through
            current.whKey = row.whKey;
            current.toMerge.push(row);

            next();
        } else {
            // compare previous and current key
            if (current.whKey === row.whKey) {
                console.log('Save current::key match');
                // same key, push this object on.
                current.toMerge.push(row);

                this.push(row);
                next();
            } else {
                console.log('Save current::new key');
                // new key? check to see if either
                // row was updated
                // console.log('Check for updated');

                var makeSave = false;
                current.toMerge.forEach(function (drow) {
                    if (drow.updated) {
                        makeSave = true;
                    }
                });

                var merged = {
                    key: current.whKey,
                    value: mergeData(current.toMerge)
                };
                
                if (makeSave) {
                    self._firebase
                        .webhook
                        .child(merged.key)
                        .set(merged.value, function () {
                            current.toMerge = [row];
                            current.whKey = row.whKey;

                            console.log('Save current::saved.');

                            stream.push(merged);
                            next();
                        });
                } else {
                    // reset current
                    current.toMerge = [row];
                    current.whKey = row.whKey;

                    this.push(merged);
                    next();
                }
            }
        }
    }

    function mergeData (data) {
        // baseline 
        var mergedData = data.pop().webhook;

        data.forEach(function (toMerge) {
            var resolvedKey = toMerge.toResolve.relationshipKey;
            mergedData[resolvedKey] = toMerge.webhook[resolvedKey];
        });

        return mergedData;
    }
}

/* end relationship resolution - rr */
