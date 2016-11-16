var debug = require( 'debug' )( 'elastic-search-api' )
var ElasticSearchClient = require( 'elasticsearchclient' )
var extend = require( 'xtend' )

module.exports = ElasticSearch;

function ElasticSearch () {
  if ( ! ( this instanceof ElasticSearch ) ) return new ElasticSearch();

  var serverName = process.env.ELASTIC_SEARCH_SERVER.replace('http://', '').replace('https://', '');
  serverName = serverName.split(':')[0];
  var elasticOptions = {
      host: serverName,
      port: 9200,
      auth: {
        username: process.env.ELASTIC_SEARCH_USER,
        password: process.env.ELASTIC_SEARCH_PASSWORD
      }
    };

  debug( 'elasticOptions' )
  debug( elasticOptions )

  var elastic = new ElasticSearchClient( elasticOptions );

  function addIndex ( toIndex, callback ) {
    debug( 'addIndex', toIndex )

    var document = extend( {}, toIndex.document );
    document.__oneOff = toIndex.oneOff || false;

    elastic.index(
        toIndex.indexName,
        toIndex.typeName,
        document,
        toIndex.id,
        function (error, data) {
          if (error) {
            debug( 'elastic index error:', error )
            callback( error, undefined );
          }
          else {
            debug( 'elastic index data:', data )
            callback( null, JSON.parse(data) )
          }
        } );
  }

  function deleteIndex ( toDelete, callback ) {
    debug( 'deleteIndex', toDelete )

    elastic.deleteDocument( toDelete.indexName, toDelete.typeName, toDelete.id )
      .on( 'data', function ( data ) {
        debug( 'elastic delete data:', JSON.parse(data) )
        callback( null, data )
      } )
      .on( 'error', function ( error ) {
        debug( 'elastic delete error:', error )
        callback( error, undefined )
      } )
      .exec()
  }

  return {
    addIndex: addIndex,
    deleteIndex: deleteIndex,
    elastic: elastic,
  }
}
