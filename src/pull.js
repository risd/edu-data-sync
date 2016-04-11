require('../env.js')();
var debug = require('debug')('pull');

var from = require('from2-array');
var through = require('through2');

var levelPath = process.cwd() + '/.db';

var level = require('level');
var db = level(levelPath, {
  keyEncoding: require('bytewise'),
  valueEncoding: 'json'
});

var syncProtocol = require('../sync-protocol-level.js');

var fbref = require('../firebaseref.js');

var sync = lvlSync.bind(null, {employees: true}, db);

pull()
  .pipe(stash(db))
  .on('finish', function () {
    // run sync?
    sync()
      .on('finish', function () {
        debug('Sync finish.');
      });
  });

// sync();


function pull (stash) {
  var t = through.obj();

  fbref(function (err, fb) {
    debug('Firebase reference acquired.');
    fb.once('value', function (snapshot) {
      debug('Current firebase data acquired');
      t.push(snapshot.val())
      t.push(null);
    });
  });

  return t;
}



function stash (db) {

  // Saves objects coming in, to the leveldb
  function stasher (callback) {
    return through.obj(
      function stashing (row, enc, next) {
        db.put(row.key, row.value, function () {
          debug('Put %s', JSON.stringify(row.key));
          next();
        });
      },
      function endStashing () {
        debug('End: Stashing firebase data into leveldb.');
        if (callback) {
          callback();
        }
      })
  }

  return through.obj(function (current, enc, next) {
    debug('Stashing firebase data in leveldb.');

    // Pass through for objects to save.
    var input = through.obj();
    // Save them to the database, the callback
    // will tell this stream its ready for the
    // next object
    var write = stasher(next);

    input.pipe(write);

    // Push all the objects into the streams
    // for them to be saved
    Object.keys(current.data)
      .forEach(function (contentType) {
        if (current.contentType[contentType].oneOff) {
          input.push({
            key: ['data', contentType],
            value: current.data[contentType] });
        }
        else {
          Object.keys(current.data[contentType])
            .forEach(function (firebaseKey) {
              input.push({
                key: ['data', contentType, firebaseKey],
                value: current.data[contentType][firebaseKey]
              });
            });
        }
      });

    // Push content type objects into leveldb
    Object.keys(current.contentType)
      .forEach(function (contentType) {
        input.push({
          key: ['contentType', contentType],
          value: current.contentType[contentType]
        });
      });

    // Push null to close the stream
    input.push(null);
  });
}

function lvlSync (opts, db) {
  debug('Sync using leveldb.');

  var sourcePrototypyes = [];

  if (opts.employees) {
    sourcePrototypyes.push(require('../sources/employees/index.js'));
  }

  var sources = sourcePrototypyes
    .map(function (model) {
      syncProtocol(model, db)
      return model();
    })
    .concat([null]);

  return from.obj(sources)
    .pipe(GetSourcesData())
    .pipe(AddSourceToWebhook())
    .pipe(RemoveFromWebhookBasedOnSource())
    .pipe(ResolveRelationships())
    .pipe(ResolveReverseRelationships())
    .pipe(through.obj(function (source, enc, next) {
      debug('%s: finished syncing source', source.webhookContentType);
      next();
    }));

  function GetSourcesData () {
    return through.obj(getSourceData);

    function getSourceData (source, enc, next) {
      debug('%s:start: get all data from source & put into leveldb.',
        source.webhookContentType);

      source.errors = [];

      if (('listSource' in source) &&
          ('sourceStreamToFirebaseSource' in source)) {

        pump(
          source.listSource(),
          source.sourceStreamToLevelSource(),
          end);
      }
      else {
        end(true);
      }

      function end (err) {
        debug('%s:end: get all data from source & put into leveldb.',
        source.webhookContentType);

        var stepError = new Error('%s: could not get source data.',
          source.webhookContentType);
        if (err) {
          source.errors
            .push(stepError);

          if (err instanceof Error) {
            source.errors.push(err);
          }
        }
        next(null, source);
      }
    }
  }

  function AddSourceToWebhook () {
    return through.obj(addSource);

    function addSource (source, enc, next) {
      debug('%s:start: add source data to webhook data.',
        source.webhookContentType);

      if ((source.errors.length === 0) &&
          ('listFirebaseSource' in source) &&
          ('addSourceToWebhook' in source)) {
        pump(
          source.listLevelSource(),
          source.addSourceToWebhook(),
          end);
      }
      else {
        end(true);
      }

      function end (err) {
        debug('%s:end: add source data to webhook data.',
          source.webhookContentType);

        var stepError = new Error(
          '%s: could not add source data to webhook data.',
          source.webhookContentType);
        if (err) {
          source.errors
            .push(stepError);

          if (err instanceof Error) {
            source.errors.push(err);
          }
        }
        next(null, source);
      }
    }
  }

  function RemoveFromWebhookBasedOnSource () {
    /**
     * List the webhook and source values
     * if the webhook value is not in the
     * source values, invoke the model's
     * `webhookValueNotInSource`
     */
    return through.obj(remove);

    function remove (source, enc, next) {
      debug('%s:start: remove from WebHook based on source.',
        source.webhookContentType);
      
      if ((source.errors.length === 0) &&
          ('listFirebaseWebhook' in source) &&
          ('addInSourceBool' in source) &&
          ('updateWebhookValueNotInSource' in source)) {
        pump(
          source.listLevelWebhook(),
          source.addInSourceBool(),
          source.updateWebhookValueNotInSource(),
          end);
      }
      else {
        end(true);
      }

      function end (err) {
        debug('%s:end: remove from WebHook based on source.',
          source.webhookContentType);
        var stepError = new Error(
          'Could not remove from webhook based on source.');
        if (err) {
          source.errors
            .push(stepError);

          if (err instanceof Error) {
            source.errors.push(err);
          }
        }
        next(null, source);
      }
    }
  }

  function ResolveRelationships () {
    return through.obj(relationships);

    function relationships (source, enc, next) {
      debug('%s:start: Resolve Relationships.',
        source.webhookContentType);

      if ((source.errors.length === 0) &&
          ('rrListWebhookWithRelationshipsToResolve' in source) &&
          ('rrGetRelatedData' in source) &&
          ('rrResetRelated' in source) &&
          ('rrPopulateRelated' in source) &&
          ('rrSaveReverse' in source) &&
          ('rrSaveCurrent' in source)) {
        pump(
          source.rrListWebhookWithRelationshipsToResolve(),
          source.rrGetRelatedData(),
          source.rrPopulateRelated(),
          source.rrSaveReverse(),
          source.rrSaveCurrent(),
          end);
      }
      else {
        end(true);
      }

      function end (err) {
        debug('%s:end: Resolve Relationships.',
          source.webhookContentType);
        var stepError = new Error(
          'Could not resovle relationships.');
        if (err) {
          source.errors
            .push(stepError);

          if (err instanceof Error) {
            source.errors.push(err);
          }
        }
        next(null, source);
      }
    }
  }

  function ResolveReverseRelationships () {
    return through.obj(reverse);

    function reverse (source, enc, next) {
      debug('%s:start: Resolve Reverse Relationships.',
        source.webhookContentType);

      if ((source.errors.length === 0) &&
          ('rrrList' in source) &&
          ('rrrPopulate' in source)) {
        pump(
          source.rrrList(),
          source.rrrPopulate(),
          end);
      }
      else {
        end(true);
      }


      function end (err) {
        debug('%s:end: Resolve Reverse Relationships.',
          source.webhookContentType);
        var stepError = new Error(
          'Could not resovle relationships.');
        if (err) {
          source.errors
            .push(stepError);

          if (err instanceof Error) {
            source.errors.push(err);
          }
        }
        next(null, source);
      }
    }
  }
} /* end of lvlSync */
