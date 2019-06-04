var miss = require( 'mississippi' )

// node compare.js first-file second-file
var files = filesFromArgs( process.argv )
var Employees = initialzeEmployee()

miss.pipe(
  Employees.listSourceLocal( files[ 0 ] ),
  counter(),
  function doneCounting () {}
)

function counter () {
  var count = 0;
  return miss.through.obj( countRows, pushCount )

  function countRows ( row, enc, next ) {
    count += 1
    next()
  }

  function pushCount () {
    console.log( 'employee-count:' + count )
    this.push( count )
    this.push( null )
  }
}

function filesFromArgs ( args ) {
  var files = args.slice( 2 )
  if ( files.length !== 1 ) throw new Error( 'Expected a single file path as input.' )
  return files.map( formatPath )
}

function initialzeEmployee () {
  return require('./index.js')( { aws: { key: 'key', secret: 'secret', bucket: 'bucket' } } )
}

function formatPath ( file ) {
  return `${ __dirname }/${ file }`
}

function sink () { return through.obj( sinkFn  ) }
function sinkStr () { return through( sinkFn ) }

function sinkFn ( row, enc, next ) { next() }

function handlerError ( scope ) {
  return function ( error ) {
    if ( error ) {
      console.log( scope )
      console.log( error )
    }
  }
}
