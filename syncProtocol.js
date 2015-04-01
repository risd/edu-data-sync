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


    if (typeof model.prototype.sourceStreamToFirebaseSource === 'undefined') {
        model.prototype.sourceStreamToFirebaseSource = sourceStreamToFirebaseSource;
    }

    

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
    // If something is getting updated, it will
    // likely occur here.
    return through.obj(populate);

    function populate (row, enc, next) {
        // console.log('rrPopulateRelated');
        if (row.relatedDataCollection) {
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
                                console.log('\n\nMatch!\n\n');
                                // sort out updating objects
                                row.updated = true;
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
        if (row.updated) {
            // console.log('Save.');
        } else {
            // console.log('Do not save.');
        }

        this.push(row);
        next();
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
                // same key, push this object on.
                current.toMerge.push(row);

                this.push(row);
                next();
            } else {
                // new key? check to see if either
                // row was updated
                // console.log('Check for updated');

                var makeSave = false;
                current.toMerge.forEach(function (d) {
                    if (d.updated) {
                        makeSave = true;
                    }
                });

                // TODO
                // this will need to inspect all
                // in toMerge, and see which key
                // they were looking to resolve,
                // and update each other.
                var merged = {
                    key: current.whKey,
                    data: current.toMerge.slice(0)
                };

                // TODO
                // on merge/save complete, push
                // the merged object

                // reset to merge
                current.toMerge = [row];
                current.whKey = row.whKey;

                if (makeSave) {
                    // console.log('Make merge & save');

                    stream.push(merged);
                    next();
                } else {
                    // console.log('Do not save.');

                    this.push(merged);
                    next();
                }
            }
        }
    }
}

/* end relationship resolution - rr */
