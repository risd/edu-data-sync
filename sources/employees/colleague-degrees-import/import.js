var Firebase = require('webhook-cms-pull/firebaseref')
var Env = require('../../../env.js')()

var employees = {}
var firebase;

module.exports = doImport;

function doImport () {
  var rows = require( __dirname + '/2019-08-22--colleague-degrees.json' )
  rows.forEach( rowToEmployeesDegrees )
  Firebase( Env.asObject().firebase, handleFirebase )
}


function handleFirebase ( error, firebaseRef ) {
  if ( error ) {
    console.log( error )
    return process.exit( 1 )
  }
  var firebase = firebaseRef
  firebase.child( 'data' ).child( 'employees' ).once( 'value' )
    .then( function ( employeeSnapshot ) {
      var firebaseEmployees = employeeSnapshot.val()

      var updates = Object.keys( firebaseEmployees )
        .map( fieldsToSet )
        .filter( removeNull )
        .reduce( toSingleObject, {} )

      return firebase.child( 'data' ).child( 'employees' ).update( updates )

      // firebaseKey => { fieldKey, fieldValue, firebaseKey } | null
      function fieldsToSet ( firebaseKey ) {
        var firebaseEmployeeId = firebaseEmployees[ firebaseKey ].colleague_id
        if ( !( employees.hasOwnProperty( firebaseEmployeeId ) && employees[ firebaseEmployeeId ] ) ) {
          return null
        }

        return {
          fieldKey: firebaseKey + '/colleague_institutions_attended',
          fieldValue: employees[ firebaseEmployeeId ],
          firebaseKey: firebaseKey,
        }
      }

      // {}, { fieldKey, fieldValue, firebaseKey } => { ...fieldKeys: ...fieldValues }
      function toSingleObject ( previous, current ) {
        var combine = {}
        combine[ current.fieldKey ] = current.fieldValue
        return Object.assign( previous, combine )
      }
    } )
    .then( function () {
      console.log( 'success' )
      process.exit( 0 )
    } )
    .catch( function ( error ) {
      if ( error ) {
        console.log( error )
        return process.exit( 1 )
      }
    } )
}


function rowToEmployeesDegrees ( row ) {
  var education = row["Education"]
    .split( ';' )
    .map( trimString )
    .filter( removeEmpty )
    .map( function ( str ) {
      return str.replace( / , /g, ', ' )
    } )
    .map( function ( institution ) {
        return { institution: institution }
    } )
    .sort( function ( a, b ) {
        return a.institution < b.institution
            ? -1
            : a.institution > b.institution
                ? 1
                : 0;
    } );

  employees[ row[ "Id" ] ] = education
}

function trimString ( str ) { return str.trim() }
function removeEmpty ( str ) { return str.length > 0 }
function removeNull ( x ) { return x !== null }
