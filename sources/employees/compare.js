var miss = require( 'mississippi' )
var through = require('through2')

// node compare.js first-file second-file
var files = filesFromArgs( process.argv )
var Employees = initialzeEmployee()

// read IDs for first file into an array
// read IDs of second file, see if they are in the first file's array
// if not, keep them
// 1 -> 1s
// 2 -> 1s -> 2s
miss.pipe(
  unique( files ),
  stringify(),
  process.stdout,
  handlerError( 'top-level' )
)

function unique ( files ) {
  var result = through.obj()

  miss.pipe(
    Employees.listSourceLocal( files[ 0 ] ),
    collectIds(),
    compare( files[ 1 ] ),
    result,
    sink(),
    handlerError( 'unique' )
  )

  return result;

  function compare ( fileToCompare ) {
    return through.obj( filterer )

    function filterer ( ids, enc, next ) {
      var filterStream = this;
      miss.pipe(
        Employees.listSourceLocal( fileToCompare ),
        through.obj( filterRows, next ),
        handlerError( 'compare' )
      )

      function filterRows ( row, enc, next ) {
        if ( ids.indexOf( Employees.keyFromSource( row ) ) === -1 )
          filterStream.push( row )
        next()
      }
    }
  }
}

function collectIds () {
  var collection = []
  var collector = Employees.keyFromSource;
  return through.obj( aggregate, emit )

  function aggregate ( row, enc, next ) {
    collection.push( collector( row ) )
    next()
  }

  function emit () {
    this.push( collection )
    this.push( null )
  }
}

function stringify () {
  return through.obj(function (row, enc, next) {
    this.push(JSON.stringify(row) + "\n");
    next();
  });
}

function filesFromArgs ( args ) {
  var files = args.slice( 2 )
  if ( files.length !== 2 ) throw new Error( 'Expected two file paths as input.' )
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
