var debug = require( 'debug' )( 'map-coordinator' )
var EventEmitter = require( 'events' );

module.exports = MapCoordinator;
module.exports.protocol = MapProtocol;

/**
 * Apply mapFn across objects defined in the
 * mapPrototype, using the firebaseref as the 
 * source of data.
 * 
 * @param {object} options
 * @param {object} options.mapPrototype
 * @param {object} options.firebaseref
 * @param {function} complete The function called upon completing the Map
 */
function MapCoordinator ( options, complete ) {
  if ( ! ( this instanceof MapCoordinator ) ) return new MapCoordinator( options, complete )
  var self = this;

  this.mapPrototype = MapProtocol( options.mapPrototype )
  this.firebaseref = options.firebaseref;

  this.isOneOff( function ( error, isOneOff ) {
    if ( error ) return complete( error )

    var applyMapFn = self.applyMapFn( isOneOff )

    self.applyMap( applyMapFn, complete )
  } )

}

MapCoordinator.prototype.isOneOff = function ( complete ) {
  this.firebaseref.child( 'contentType' ).child( this.mapPrototype.webhookContentType ).child( 'oneOff' )
    .once( 'value', oneOffSnapshot, oneOffSnapshotError  )

  function oneOffSnapshot ( snapshot ) {
    var isOneOff = snapshot.val()
    complete( null, isOneOff )
  }

  function oneOffSnapshotError ( error ) {
    complete( error )
  }
}

/**
 * Returns function that can be used to apply the mapPrototype's mapFn.
 * @param  {Boolean} isOneOff Is the shapshot going to be in the shape of oneOff data, or multiple data.
 *                            oneOff data is a single object. multiple data is an object containing keys
 *                            to instance values.
 * @return {Function} applyMapFn ( snapshotData ) -> mappedSnapshotData
 */
MapCoordinator.prototype.applyMapFn = function ( isOneOff ) {
  var self = this;

  return isOneOff ? oneOffMap : multipleMap;

  function oneOffMap ( snapshotData ) {
    return self.mapPrototype.mapFn( snapshotData )
  }

  function multipleMap ( snapshotData ) {
    var mappedData = {};

    function applyMap ( dataKey ) {
      mappedData[ dataKey ] = self.mapPrototype.mapFn( snapshotData[ dataKey ] )
    }

    Object.keys( snapshotData ).forEach( applyMap )

    return mappedData;
  }
}

MapCoordinator.prototype.applyMap = function ( applyMapFn, complete ) {
  var firebaseDataRef = this.firebaseref.child( 'data' ).child( this.mapPrototype.webhookContentType )
  
  firebaseDataRef
    .once( 'value', function ( snapshot ) {
      var snapshotData = snapshot.val()

      var mappedSnapshotData = applyMapFn( snapshotData )

      firebaseDataRef.set( mappedSnapshotData, setComplete )

      function setComplete ( error ) {
        complete( error, mappedSnapshotData )
      }
    } )

}

/**
 * Enforces MapProtocol on model.
 * These objects are consumed by the Map function.
 *
 * Must have:
 *
 * .webhookContentType A string that defines the content type
 * .mapFn              A function the defines the 
 * 
 * @param {Function} model The prototype that describes the Map functionality
 */
function MapProtocol ( model ) {

  var enforcer = ErrorMessageAggregator( 'Model does not conform to Map protocol.' )
  
  enforcer.test( attributeTest( 'webhookContentType', 'string'), 'Requires property webhookContentType with string value that represents the webhook content type.' )
  enforcer.test( attributeTest( 'mapFn', 'function' ), 'Requires property mapFn with function value that defines how webhook items get mapped.' )

  enforcer.throw()

  return model()

  function attributeTest( nameOfAttribute, typeOfAttribute, message ) {
    return typeof model.prototype[ nameOfAttribute ] !== typeOfAttribute
  }

  function ErrorMessageAggregator ( baseMessage ) {
    var aggregateMessage = [];

    if ( typeof baseMessage === 'string' ) aggregateMessage.push( baseMessage )

    var messageCountBaseline = aggregateMessage.length;

    function includesMoreThanBase () {
      return aggregateMessage.length > messageCountBaseline;
    }
    
    function addErrorMessage ( errorMessage ) {
      if ( typeof errorMessage === 'string' ) aggregateMessage.push( errorMessage )
    }

    function addIf ( testResult, errorMessage ) {
      if ( testResult ) addErrorMessage( errorMessage )
    }

    function throwError () {
      if ( includesMoreThanBase() ) throw new Error( aggregateMessage )
    }

    return {
      test: addIf,
      throw: throwError,
    }
  }
}
