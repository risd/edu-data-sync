var path = require( 'path' )

module.exports = stringPathToArrayPaths;

function stringPathToArrayPaths ( argv ) {
  return argv.split( ',' ).map( makeAbsolutePath )
}

function makeAbsolutePath ( relativePath ) {
  return path.join( process.cwd(), relativePath )
}
