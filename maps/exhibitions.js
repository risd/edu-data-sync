var debug = require( 'debug' )( 'map-exhibitions-prototype' )
var assert = require( 'assert' )
var moment = require( 'moment' )
var timezone = require( 'moment-timezone' )

var ARCHIVED_PREFIX = 'ARCHIVED';

module.exports = MapExhibitions;

function MapExhibitions () {
  if ( ! ( this instanceof MapExhibitions ) ) return new MapExhibitions();
}

MapExhibitions.prototype.webhookContentType = 'communityexhibitions';
MapExhibitions.prototype.mapFn = mapExhibitionsFn;
MapExhibitions.prototype.mapRelatedFn = mapRelatedExhibitionsFn;

function mapExhibitionsFn ( exhibition ) {
  // if now < end_date
  //   prefix the name with ARCHIVED
  //   set list_in_news_section to false
  //   set to isDraft to true
  if ( inThePast( exhibition.end_date ) ) {
    exhibition.name = isArchivedExhibition( exhibition )
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

function mapRelatedExhibitionsFn ( widget, widgetKey, exhibitions ) {
  assert( typeof exhibitions === 'object', 'Related data needs to be passed in to update relationship widgets.' )

  if ( isRelationshipInRepeatable( widget, widgetKey ) ) {
    // relationship widget lives in a repeatable
    widget = widget.map( emptyRowIfWidgetKeyArchived ).filter( isPopulatedRow )
  }
  else if ( isMultipleRelationship( widget ) ) {
    // widget is a multiple relationship
    widget = widget.map( emptyRelationshipIfArchived ).filter( isPopulatedRelationship )
  }
  else if ( isSingleRelationship( widget ) ) {
    // widget is a single relationship
    widget = [ widget ].map( emptyRelationshipIfArchived )[ 0 ]
  }

  return widget;

  function isRelationshipInRepeatable ( widget, widgetKey ) {
    return Array.isArray( widget ) && typeof widgetKey === 'string'
  }

  function isMultipleRelationship ( widget ) {
    return Array.isArray( widget )
  }

  function isSingleRelationship ( widget ) {
    return typeof widget === 'string'
  }

  function emptyRelationshipIfArchived ( relationship ) {
    if ( ! isPopulatedRelationship( relationship ) ) return relationship;
    var relatedToKey = relationshipKey( relationship )
    var relatedExhibition = exhibitions[ relatedToKey ]
    if ( isArchivedExhibition( relatedExhibition ) ) relationship = '';
    return relationship;
  }

  function relationshipKey ( relationship ) {
    return relationship.split( ' ' )[ 1 ]
  }

  function isPopulatedRelationship ( relationship ) {
    return typeof relationship === 'string' && relationship.split( ' ' ).length === 2;
  }

  function emptyRowIfWidgetKeyArchived ( row ) {
    if ( ! isPopulatedRow( row ) ) return undefined;
    
    var rowWidget = row[ widgetKey ];
    if ( ! rowWidget ) return undefined;

    if ( isMultipleRelationship( rowWidget ) ) {
      // no such cases, not sure how it should be handled yet
      // var mappedRowWidget = rowWidget.map( emptyRelationshipIfArchived ).filter( isPopulatedRelationship )
      // if ( differentRelationshipWidget( rowWidget, mappedRowWidget ) )
    }
    else if ( isSingleRelationship( rowWidget ) ) {
      rowWidget = [ rowWidget ].map( emptyRelationshipIfArchived )[ 0 ]
      if ( ! isPopulatedRelationship( mappedRowWidget ) ) row = undefined;
    }

    return row;
  }

  function isPopulatedRow ( row ) {
    return typeof row === 'object';
  }

  function isPopulatedMultipleRelationship ( relationship ) {
    return Array.isArray( relationship ) && relationship.length > 0;
  }

  function differentRelationshipWidget ( a, b ) {
    return a.length !== b.length;
  }
}

function isArchivedExhibition ( exhibition ) {
  return typeof exhibition === 'object' && exhibition.name.startsWith( ARCHIVED_PREFIX )
}
