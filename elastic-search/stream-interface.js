var debug = require( 'debug' )( 'elastic-search-sync' )
var ElasticSearch = require( './src/elastic-search-api.js' );
var through = require( 'through2' );

module.exports = ElasticSearchSync;

function ElasticSearchSync () {
  if ( ! ( this instanceof ElasticSearchSync ) ) return new ElasticSearchSync();

  var elastic = ElasticSearch();
  var indexName = process.env.ELASTIC_SEARCH_INDEX;

  var maxAttempts = 10;

  function timeout ( attempt ) {
    var backoff = Math.pow( 2, attempt );
    var maxBackoffTime = 32000;
    var randomOffset = Math.random() * 10;

    return Math.min(backoff, maxBackoffTime) + randomOffset;
  }

  /**
   * Add a webhook object to the edu.risd.systems elastic
   * search endpoint.
   *
   * Retries up to maxAttempts
   * 
   * @param {string} typeName The webhook content-type
   * @param {object} document The item as object
   * @param {string} id       Firebase ID for the webhook item
   * @param {boolean} oneOff  Is the item being indexed a one
   *                          off content-type?
   * @param {number?} attempt Optional number that tracks the current
   *                          attempt against the API to make the call
   */
  function addIndex ( typeName, document, id, oneOff, attempt ) {
    debug( 'addIndex' )

    attempt = ( attempt || 0 )

    // Clean document
    document = Object.keys( document )
      .filter(function isNotUndefined ( key ) {
        return document[key] !== undefined;
      } )
      .reduce( function keysToObject ( object, key ) {
        object[ key ] = document[ key ];
        // objects are made into strings
        if ( typeof document[ key ] === 'object' )
          object[ key ] = JSON.stringify( document[ key ] )
        return object;
      }, {} )

    if ( attempt > maxAttempts ) return;

    elastic.addIndex( {
        indexName: indexName,
        typeName: typeName,
        document: document,
        id: id,
        oneOff: oneOff
      },
      function response ( error, data ) {
        if ( error ) return retry( error )
        if ( data && data.error ) return retry( data.error )
        debug( 'addIndex:response' )
      } )

    function retry ( error ) {
      debug( 'addIndex:retry' )
      debug( error )
      debug( document )

      setTimeout(function () {
        debug( 'addIndex:retrying' )

        addIndex( typeName, document, id, oneOff, ( attempt += 1 ) )

      }, timeout( attempt ) )
    }
  }

  /**
   * Remove a webhook object from the edu.risd.systems elastic
   * search endpoint.
   *
   * Retries up to maxAttempts
   * 
   * @param {string} typeName The webhook content-type
   * @param {string} id       Firebase ID for the webhook item
   * @param {number?} attempt Optional number that tracks the current
   *                          attempt against the API to make the call
   */
  function deleteIndex ( typeName, id, attempt ) {
    debug( 'deleteIndex' )

    attempt = ( attempt || 0 );

    if ( attempt > maxAttempts ) return;

    elastic.deleteIndex({
      indexName: indexName,
      typeName: typeName,
      id: id
    }, function (error, data) {
      if ( error ) return retry();
      if ( data && data.error ) return retry();
        debug( 'deleteIndex:response' );
    } );

    function retry () {
      debug( 'deleteIndex:retry' );

      setTimeout(function () {
        debug( 'deleteIndex:retrying' );
        deleteIndex( typeName, id, ( attempt += 1 ) );
      }, timeout( attempt ) )
    }
  }

  return {
    addIndex: addIndex,
    deleteIndex: deleteIndex,
  }
}
