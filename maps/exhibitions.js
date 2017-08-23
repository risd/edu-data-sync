var debug = require( 'debug' )( 'map-exhibitions-prototype' )
var moment = require( 'moment' )
var timezone = require( 'moment-timezone' )

var ARCHIVED_PREFIX = 'ARCHIVED';

module.exports = MapExhibitions;

function MapExhibitions () {
  if ( ! ( this instanceof MapExhibitions ) ) return new MapExhibitions();
}

MapExhibitions.prototype.webhookContentType = 'communityexhibitions';
MapExhibitions.prototype.mapFn = mapExhibitionsFn;

function mapExhibitionsFn ( exhibition ) {
  // if now < end_date
  //   prefix the name with ARCHIVED
  //   set list_in_news_section to false
  //   set to isDraft to true
  if ( inThePast( exhibition.end_date ) ) {
    exhibition.name = exhibition.name.startsWith( ARCHIVED_PREFIX )
      ? exhibition.name
      : [ ARCHIVED_PREFIX, exhibition.name ].join( ' ' )
    exhibition.list_in_news_section = false;
    exhibition.isDraft = true;
  }
  
  return exhibition;

  function inThePast( timestamp ) {
    if ( typeof timestamp !== 'string' ) return false;
    var now = timezone().tz( 'America/New_York' )
    return moment( endOfDay( timestamp ) ).isBefore( now )
  }

  function endOfDay ( timestamp ) {
    return [ timestamp.split( 'T' )[ 0 ], 'T23:59:59-04:00' ].join( '' )
  }
}
