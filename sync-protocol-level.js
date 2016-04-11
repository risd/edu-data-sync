/* Pass in a model, and modify it to get the common 
   functions necessary for sync, and consistent
   across any api/implementation */

var debug = require('debug')('sync-protocol-level');

var clone = require('clone');
var from = require('from2-array');
var through = require('through2');
var combine = require('stream-combiner2');
var hat = require('hat');
var extend = require('./util.js').extend;

module.exports = LevelSyncProtocol;

function LevelSyncProtocol (model, level) {

  var m = ['Model does not conform to Sync protocol.'];


  model.prototype.listLevelWebhook = listLevelWebhook;
  model.prototype.listLevelSource = listLevelSource;
  model.prototype.addSourceToWebhook = addSourceToWebhook;
  model.prototype.addInSourceBool = addInSourceBool;

  // Resolve relationship pipeline - Start
  model.prototype.rrListWebhookWithRelationshipsToResolve =
    rrListWebhookWithRelationshipsToResolve;
  model.prototype.rrGetRelatedData = rrGetRelatedData;
  model.prototype.rrPopulateRelated = rrPopulateRelated;
  model.prototype.rrSaveReverse = rrSaveReverse;
  model.prototype.rrSaveCurrent = rrSaveCurrent;

  // - helper functions
  model.prototype.listLevelRelated = listLevelRelated;
  model.prototype.listLevelRelatedConcat = listLevelRelatedConcat;

  if (typeof model.prototype.relationshipsToResolve !== 'function') {
    m.push('Requires relationshipsToResolve method.');
  }
  if (typeof model.prototype.dataForRelationshipsToResolve !== 'function') {
    m.push('Requires dataForRelationshipsToResolve method.');
  }
  // Resolve relationship pipeline - End


  // Resolve reverse relationship pipeline - Start
  // This pipeline also refers to `relationshipsToResolve`
  // but is accounted for as part of the resolve relationship
  // pipeline, so its not checked for here.
    
  model.prototype.rrrList = rrrList;
  model.prototype.rrrPopulate = rrrPopulate;
    
  // Resolve reverse relationship pipeline - End


  // Defaults for overwrittable methods - Start
  if (typeof model.prototype.sourceStreamToLevelSource === 'undefined') {
    model.prototype.sourceStreamToLevelSource = sourceStreamToLevelSource;
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
  var reversePath = 'eduSync/reverseRelationships';

  // model.prototype._firebase = {
  //   webhook: firebaseref.child(webhookPath),
  //   source:  firebaseref.child(sourcePath),
  //   webhookDataRoot: firebaseref.child(webhookDataRoot),
  //   reverse: firebaseref.child(reversePath)
  // };
  model.prototype.keys = {
    webhook: ['data', type],
    source: ['sync', type],
    reverse: ['sync-rr'],
    webhookRoot: ['data']
  }

  model.prototype.level= level;
}

/**
 * List the data under the ['data', ...] key
 * for the content type
 * 
 * @return {object} read stream
 */
function listLevelWebhook () {
  var self = this;

  var readStream;

  var transformStream = through.obj(
    function whify (row, enc, next) {
      this.push({ whKey: row.key, webhook: row.value });
      next();
    });

  if (self.webhookContentTypeOneOff === false) {
    readStream = this.level.createReadStream({
        start: this.keys.webhook.concat([null]),
        end: this.keys.webhook.concat([undefined])
      });
  }
  else {
    readStream = through.obj();
    self.level.get(this.keys.webhook, function (err, value) {
      readStream.push({ key: self.keys.webhook, value: value });
      readStream.push(null);
    });
  }

  return readStream.pipe(transformStream);
}

function listLevelSource () {
  var self = this;

  var readStream;

  var transformStream = through.obj(
    function srcify (row, enc, next) {
      this.push({ srcKey: row.key, source: row.value });
      next();
    });

  if (self.webhookContentTypeOneOff === false) {
    readStream = this.level.createReadStream({
        start: this.keys.source.concat([null]),
        end: this.keys.source.concat([undefined])
      });
  }
  else {
    readStream = through.obj();
    self.level.get(this.keys.webhook, function (err, value) {
      readStream.push({ key: self.keys.webhook, value: value });
      readStream.push(null);
    });
  }

  return readStream.pipe(transformStream);
}

/**
 * listing related data for relationship resolution
 * @param  {object} toResolve Describes the data
 *                            to relate to.
 * @return {object} readStream The data to relate
 */
function listLevelRelated (toResolve) {
  var self = this;

  var readStream;

  var transformStream = through.obj(
    function whify (row, enc, next) {
      this.push({ whKey: row.key, webhook: row.value });
      next();
    });

  var keyBase = this.keys.webhookRoot
    .concat([toResolve.relateToContentType]);

  if (self.webhookContentTypeOneOff === false) {
    readStream = this.level.createReadStream({
        start: keyBase.concat([null]),
        end: keyBase.concat([undefined])
      });
  }
  else {
    readStream = through.obj();
    self.level.get(keyBase, function (err, value) {
      readStream.push({ key: keyBase, value: value });
      readStream.push(null);
    });
  }

  return readStream.pipe(transformStream);
}

function listLevelRelatedConcat (toResolve, callback) {
  var relatedData = [];
  this.listRelated(toResolve)
    .on('data', function (d) {
      relatedData.push(d);
    })
    .on('error', function (err) {
      callback(err, null);
    })
    .on('end', function () {
      callback(null, relatedData);
    });
}


/**
 * `addSourceToWebhook` is a transform stream.
 * It expects a row of the source key and data.
 * `row.{srcKey, source}`.
 *
 * A read stream of the current webhook data is
 * used to compare against the incoming source
 * data.
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

  return combine(
    through.obj(findWhKey),
    through.obj(updateWebhook));

  function findWhKey (row, enc, next) {
    var stream = this;

    var found = {
      webhook: {},
      whKey: undefined
    };

    self.listLevelWebhook()
      .on('data', function (d) {
        // d.{whKey,webhook}
        // is this our matching webhook object?
        if (self.keyFromWebhook(d.webhook) === row.srcKey) {
          found = d;
          this.destroy(); 
        }
      })
      .on('end', function (){
        stream.push(extend(row, found));
        next();
      });
  }

  function updateWebhook (row, enc, next) {
    if (!(row.whKey)) {
      row.whKey = self.keys.webhook.concat([
        '-' + hat()]);
    }

    row.webhook = self.updateWebhookValueWithSourceValue(
      row.webhook,
      row.source);

    self.level.put(row.whKey, row.webhook, function () {
      next();
    });
  }
}

function sourceStreamToLevelSource () {
  var self = this;
  
  return through.obj(toLevel);

  function toLevel (row, enc, next) {
    var stream = this;
        
    self.level.put(
      self.keys.source.concat([self.keyFromSource(row)]),
      row,
      onComplete);

    function onComplete () {
        next();
    }
  }
}


/**
 * `addInSourceBool` is a transform stream.
 * Expects `row.{whKey, webhook}`. the level
 * source stream will be used to compare values.
 * Each of the `webhook` values will be
 * compared to the `levelSource` values.
 * Incoming `webhook` values that are not
 * in the `levelSource` array will be flagged
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
    
  return through.obj(adder);

  function adder (row, enc, next) {
    var stream = this;

    row.inSource = false;

    self.listLevelSource()
      .on('data', function (d) {
        if (self.keyFromSource(d.source) ===
            self.keyFromWebhook(row.webhook)) {
          row.inSource = true;
          this.destroy();
        }
      })
      .on('end', function () {
        stream.push(row);
        next();
      });
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
    if (row.inSource === false) {
      self.level.del(row.whKey, function () {
        next();
      })
    }
    else {
      next();
    }
  }
}


/* relationship resolution - rr */

/**
 * push row.{webhook, whKey, toResolve}
 * for every relationship that needs to get
 * resolved. if there are two relationships,
 * two objects get pushed before saving,
 * merge the items back together.
 * 
 * @return {stream} through.obj
 */
function rrListWebhookWithRelationshipsToResolve () {
  return this.listLevelWebhook()
    .pipe(through.obj(function (row, enc, next) {
      var stream = this;

      // Push a reference to the existing webhook object
      // once per relationship to resolve
      self.dataForRelationshipsToResolve(row.webhook)
        .map(function (toResolve) {
          row.toResolve = toResolve;
          stream.push(clone(row));
        });

      next();
    }));
}

/**
 * Gather the related data for 
 * @return {[type]} [description]
 */
function rrGetRelatedData () {
  var self = this;
  return through.obj(get);
  function get (row, enc, next) {
    var stream = this;
    debug('Get related data');

    self.listLevelRelatedConcat(row.toResolve, function (relatedData) {
      row.toResolve.relatedData = relatedData;
      stream.push(row);
      next();
    });
  }
}


function rrPopulateRelated () {
  var self = this;

  // If something is getting updated, it will
  // likely occur here.
  return through.obj(populate);

  function populate (row, enc, next) {
    debug('rrPopulateRelated: %s', row.toResolve.relationshipKey);
    
    // Ensure we are only dealing with current data
    var relatedValue = [];
    var reverseToSave = [];

    row.toResolve.relatedData
      .forEach(function (related) {
        // {whKey, webook}
        // relatedData.webhook
        if (row.toResolve.multipleToRelate) {
          var relatedCompareValue = related.webhook
            [row.toResolve.relateToContentTypeDataUsingKey];

          // any multipleToRelate will have items to relate
          row.toResolve.itemsToRelate
            .forEach(function (itemToRelate) {
              var relateCompareValue = itemToRelate
                [row.toResolve.relateToContentType];

              if (relatedCompareValue === relateCompareValue) {
                var relationshipValue = [
                      row.toResolve.relateToContentType,
                      related.whKey.slice(-1)[0]
                  ].join(' ');

                // Is this relationship accounted for?
                if (relatedValue.indexOf(relationshipValue) === -1) {
                  // Looks like not, lets save a reference to it
                  relatedValue.push(relationshipValue);

                  // & a reference to the reverse relationship
                  // The save stratgey for reverse to save
                  // will be to get the related value from
                  // the database using the key,
                  // & doing value[updateKey].push(updateValue)
                  // & then putting that new value
                  reverseToSave.push({
                    key: related.whKey,
                    updateKey: [
                        self.webhookContentType,
                        row.toResolve.relationshipKey
                      ].join('_'),
                    updateValue: [
                        self.webhookContentType,
                        row.whKey.slice(-1)[0]
                      ].join(' ')
                  });
                }
              }
            });
        }
        else {
          if (row.toResolve.itemToRelate) {
            var relationshipValue = [
              row.toResolve.relateToContentType,
              row.toResolve.relateToContentType
            ].join(' ');

            if (relatedValue.indexOf(relationshipValue) === -1) {
              relatedValue.push(relationshipValue);

              reverseToSave.push({
                key: related.whKey,
                updateKey: [
                    self.webhookContentType,
                    row.toResolve.relationshipKey
                  ].join('_'),
                updateValue: [
                    self.webhookContentType,
                    row.whKey.slice(-1)[0]
                  ].join(' ')
              });
            }
          }
        }
      });

    row.webhook[row.toResolve.relationshipKey] = relatedValue;
    row.toResolve.reverseToSave = reverseToSave;

    this.push(row);
    next();
  }
}

function rrSaveReverse () {
  var self = this;

  return through.obj(save);

// Saving reverse values here is not going to work
// we need them to be saved ONCE per element to
// update, and key to update

  function save (row, enc, next) {
    var stream = this;

    // Objects to save
    var input = from.obj(
      row.toResolve.reverseToSave
        .concat([null]));

    // Saving process
    var sink = dehydrateReverse()

    input.pipe(sink).on('finish', function () {
      stream.push(row);
      next();
    });
  }

  function dehydrateReverse () {
    // Save to leveldb under the key
    // [reverse, whKey, updateKey, updateValue ]
    // ['sync-rr',
    //  ['data', 'departments', '-gd'],
    //  'employees_related_departments',
    //  'employees -john-caserta-id'
    // ]
    // With a value of true
    return through.obj(function (toSave, enc, next) {
      var key = self.keys.reverse
        .concat([
          toSave.key,
          toSave.updateKey,
          toSave.updateValue
        ]);

      self.level.put(key, true, function () {
        next();
      });
    });
  }
}

function rrSaveCurrent () {
  var self = this;

  return through.obj(save);

  function save (row, enc, next) {
    var stream = this;

    self.level.get(row.whKey, function (err, value) {
      value[row.toResolve.relationshipKey] =
        row.webhook[row.toResolve.relationshipKey];

      self.level.put(row.whKey, value, function () {
        next();
      });
    });     
  }
}

/* end relationship resolution - rr */


/* resolve reverse relationship - rrr - start */

/**
 * List all reverse keys to resolve
 * @return {object} readStream
 */
function rrrList () {
  var self = this;

  return this.level.createReadStream({
      start: this.keys.reverse.concat([null]),
      end: this.keys.reverse.concat([undefined])
    });
}

/**
 * Using the key structure of ['sync-rr', ... ]
 * get & update related values
 * 
 * @return {object} sinkStream
 */
function rrrPopulate () {
  var self = this;

  var updateKey = null;
  var dirty = false;

  return through.obj(function (row, enc, next) {
    // row.key = ['sync-rr', whKey, updateKey, updateValue]
    // row.value = true
    var whKey = row.key[1]

    if (row.key[2] !== updateKey) {
      updateKey = row.key[2];
      dirty = true;
    }

    var updateValue = row.key[3];

    self.level.get(whKey, function (err, value) {
      if (dirty) {
        value[updateKey] = [];
        dirty = false;
      }

      value[updateKey].push(updateValue);

      self.level.put(whKey, value, function () {
        next();
      });
    });
  });
}

/* resolve reverse relationship - rrr - end */
