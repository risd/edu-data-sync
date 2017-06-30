var debug = require('debug')('signal-build');
var through = require('through2');

module.exports = SignalBuild;
module.exports.stream = SignalBuildStream;

/**
 * Send a build signal for the site.
 * 
 * @param {object}   options
 * @param {object}   options.firebase
 * @param {string}   options.siteName
 * @param {string}   options.user?
 * @param {Function} callback
 */
function SignalBuild ( options, callback ) {
  if ( ! ( this instanceof SignalBuild ) ) return new SignalBuild( options, callback )
  if ( !options ) options = {}

  debug( 'send' )

  try {
    var buildCommandReference = options.firebase.root().child( 'management/commands/build' )

    var data = {
      userid: options.user || 'mgdevelopers@risd.edu',
      sitename: options.siteName,
      id: uniqueId(),
    }

    buildCommandReference.child( data.sitename ).set( data, function ( error ) {
      debug( 'send:done' )
      debug( error )

      if ( error ) return callback( error )
      else return callback( null, data )
    } )

  } catch( error ) {
    debug( 'send:done' )
    debug( error )
    
    callback( error )
  }
}

/**
 * Send a build signal for the site. First configure with
 * a Firebase reference, then signal with a sitename.
 */
function SignalBuildStream () {
  if ( ! ( this instanceof SignalBuildStream ) ) return new SignalBuildStream()

  var firebase;

  return {
    config: config,
    send  : send,
  }

  function config () {
    return through.obj( function ( firebaseRef, enc, next ) {
      firebase = firebaseRef;
      next( null, firebaseRef );
    } )
  }

  /**
   * @param {object}   options
   * @param {string}   options.siteName
   * @param {string}   options.user?
   */
  function send ( options ) {
    return through.obj( function ( row, enc, next ) {
      debug( 'send-from-stream' )
      var signalOptions = Object.assign( options, { firebase: firebase } )
      SignalBuild( signalOptions, function ( error ) {
        if ( error ) return next( error )
        next( null, row )
      } )
    } )
  }

}

function uniqueId() {
  return Date.now() + 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}
