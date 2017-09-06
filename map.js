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

  // save reference for coordination
  this.mapPrototype = MapProtocol( options.mapPrototype )
  this.firebaseref = options.firebaseref;

  // coordination
  this.isOneOff( function ( error, isOneOff ) {
    if ( error ) return complete( error )

    // function used to apply the Map
    var applyMapFn = self.applyMapFn( isOneOff )

    // DataToMap => MappedData
    self.applyMap( applyMapFn, complete )
    
    // relationship work in progress
    // self.applyMap( applyMapFn, function ( error, mappedData ) {
    //   self.relatedContentTypeKeyPaths( function ( error, relatedContentTypeKeyPaths ) {
    //     debug( relatedContentTypeKeyPaths )
    //     complete( error, relatedContentTypeKeyPaths )
    //   } )
    // } )

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
 * () => [ ContentTypeKeyPathControl ]
 *
 * ContentTypeKeyPathControl : { keyPath : ContentTypeKeyPath, control: ContentTypeControl }
 * 
 * @param  {Function} complete Callback
 */
MapCoordinator.prototype.relatedContentTypeKeyPaths = function ( complete ) {
  var siteDataRef = this.firebaseref.child( 'data' )
  var mappedContentType = this.mapPrototype.webhookContentType;

  this.firebaseref.child( 'contentType' )
    .once( 'value', contentTypeSnapshot, contentTypeError )

  function contentTypeSnapshot ( snapshot ) {
    var contentTypes = snapshot.val()
    var relationships = relationshipsForContentType( mappedContentType, contentTypes )
    var relationshipKeyPaths = relationships.map( keepKeys( 'keyPath' ) )
    complete( null, relationshipKeyPaths )
  }

  function contentTypeError ( error ) {
    complete( error )
  }

  function relationshipsForContentType ( relatedToContentType, contentTypes ) {
    var isRelatedControl = function ( control ) {
      return ( control.controlType === 'relation' && control.meta.contentTypeId === relatedToContentType )
    }

    var keysControls = contentTypeKeysControls( contentTypes )
    var relationships = keysControls.filter( controlPasses( isRelatedControl ) )

    return relationships;

    function controlPasses ( predicate ) {
      return function ( keyPathControlPair ) {
        return predicate( keyPathControlPair.control )
      }
    }
  }

  /**
   * ContentTypes => [ ContentTypeKeyPathControl ]
   *
   * ContentTypeKeyPath : [ type, widget ]
   *  | [ type, widget, [], grid-key ]
   *  | [ type, {}, widget ]
   *  | [ type, {}, widget, [], grid-key ]
   *
   * ContentTypeControl : { name : string, controlType: string, controls : [ ContentTypeControl ]? }
   *
   * ContentTypeKeyPathControl : { keyPath : ContentTypeKeyPath, control: ContentTypeControl }
   * 
   * @param  {object} contentTypes  The webhook contentType object for the site
   * @return {object} pairs         Array of ContentTypeKeyPathControl
   */
  function contentTypeKeysControls ( contentTypes ) {
    var pairs = [];

    function addPair ( keyPath, control ) {
      pairs.push( {
        keyPath: keyPath.slice( 0 ),
        control: Object.assign( {}, control ),
      } )
    }

    Object.keys( contentTypes ).forEach( function ( contentTypeKey ) {
      var contentType = contentTypes[ contentTypeKey ]
      var contentTypeKeyPath = [ contentTypeKey ]

      if ( contentType.oneOff === false ) contentTypeKeyPath.push( {} )

      contentType.controls.forEach( function ( control ) {
        var keyPath = contentTypeKeyPath.concat( [ control.name ] )

        if ( control.controlType === 'grid' ) {
          keyPath.push( [] )

          control.controls.forEach( function ( gridControl ) {
            var gridControlKeyPath = keyPath.concat( [ gridControl.name ] )
            addPair( gridControlKeyPath, gridControl )
          } )
        }
        else {
          addPair( keyPath, control )
        }
      } )
    } )

    return pairs;
  }

  function keepKeys ( keys ) {
    if ( typeof keys === 'string' ) keys = [ keys ]
    return function ( value ) {
      var keep = {}
      keys.forEach( function ( key ) { keep[ key ] = value[ key ] } )
      return keep;
    }
  }
}

/**
 * ( controlKeyPaths : [ { keyPath : ContentTypeKeyPath } ] ) => [ AbsoluteControlKeyPathData ]
 *
 * AbsoluteControlKeyPathData : { keyPath : ContentTypeKeyPath, control : ControlData }
 *
 *   Where `control` is the value of the `control-key` of the ContentTypeKeyPath
 *
 * ContentTypeKeyPath : [ type, control-key ]
 *   | [ type, control-key, [], grid-key ]
 *   | [ type, item-key, control-key ]
 *   | [ type, item-key, control-key, [], grid-key ]
 *
 * ControlData : ( {} | [] | '' )
 * 
 * @param  {[type]} controlKeyPath
 * @param  {[type]} complete       Function to call with 
 */
MapCoordinator.prototype.dataForContentTypeKeyPaths = function ( controlKeyPath, complete ) { }

/**
 * ( controlKeyPathDataArray : [ AbsoluteControlKeyPathData ], mappedData ) => ( mappedControlKeyPathData : [ RelativeControlKeyPathData ] )
 *
 * RelativeControlKeyPath : [ type, control-key ]
 *   | [ type, item-key, control-key ]
 *   
 * ControlData : ( {} | [] | '' )
 *
 * RelativeControlKeyPathData : { keyPath: RelativeControlKeyPath, control: ControlData }
 * 
 * @param  {object} controlKeyPathDataArray  The AbsoluteControlKeyPathData's to apply the `mapRelatedExhibitionsFn` on.
 * @param  {object} mappedData               The data that resulted from `applyMapFn`
 * @return {object} mappedDataKeyPathPairs   The result of the appplication of `mapRelatedExhibitionsFn` on `controlKeyPathDataArray`
 */
MapCoordinator.prototype.applyMapRelatedFn = function ( controlKeyPathDataArray, mappedData ) { }

/**
 *
 * controlKeyPathDataArray => controlKeyPathDataArray
 * 
 * controlKeyPathDataArray : [ RelativeControlKeyPathData ]
 *
 * `controlKeyPathDataArray` control's are saved to their keys.
 * The callback `complete` is invoked with the same input data,
 * `controlKeyPathDataArray`
 * 
 * @param  {object} controlKeyPathDataArray
 * @param  {Function} complete              The function to call upon saving `controlKeyPathDataArray`
 */
MapCoordinator.prototype.saveControlKeyPathData = function ( controlKeyPathDataArray, complete ) {

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
