var debug = require( 'debug' )( 'map-exhibitions-prototype' )
var assert = require( 'assert' )
var moment = require( 'moment' )
var timezone = require( 'moment-timezone' )

var ARCHIVED_PREFIX = 'ARCHIVED';
var PAST_END_DATE_PREFIX = 'ENDED';

/* These widget keys will be preserved when an exhibition is marked as PAST_END_DATE */
var PRESERVE_PAST_END_DATE_CONTROL_KEYS = [ 'community_exhibitions_related_campus_resources' ]

module.exports = MapExhibitions;

function MapExhibitions () {
  if ( ! ( this instanceof MapExhibitions ) ) return new MapExhibitions();
}

MapExhibitions.prototype.webhookContentType = 'communityexhibitions';
MapExhibitions.prototype.mapFn = mapExhibitionsFn;
MapExhibitions.prototype.mapRelatedFn = mapRelatedExhibitionsFn;

function mapExhibitionsFn ( exhibition ) {

  /* if now < end_date && ! hasRelatedCampusResource, archive the exibition */
  if ( inThePast( exhibition.end_date ) && ( ! hasRelatedCampusResource( exhibition ) ) ) {
    archiveExhibition( exhibition )
  }
  /* if now < end_date + 180 days && hasRelatedCampusResource, archive the exibition */
  else if ( inThePast( exhibition.end_date, 18, 'months' ) && hasRelatedCampusResource( exhibition ) ) {
    archiveExhibition( exhibition )
  }
  /* if now < end_date && hasRelatedCampusResource, remove the relationships that promote the exhibition */
  else if ( inThePast( exhibition.end_date ) && hasRelatedCampusResource( exhibition ) ) {
    pastEndDateExhibition( exhibition )
  }
  
  return exhibition;

  function inThePast( timestamp, durationInPast, durationType ) {
    if ( typeof timestamp !== 'string' ) return false;
    var now = timezone().tz( 'America/New_York' )
    
    durationInPast = durationInPast || 0;
    durationType = durationType || 'days';

    var durationObject = {};
    durationObject[ durationType ] = durationInPast;
    
    return moment( endOfDay( timestamp ) ).add( durationObject ).isBefore( now )
  }

  function endOfDay ( timestamp ) {
    return [ timestamp.split( 'T' )[ 0 ], 'T23:59:59-04:00' ].join( '' )
  }

  function archiveExhibition ( exhibition ) {
    /* set the archival name  */
    markAsArchived( exhibition )

    /* reset all relationship fields */
    delete exhibition.related_campus_resources;
    removePromotionRelationships( exhibition );
    exhibition.isDraft = true;
  }

  function pastEndDateExhibition ( exhibition ) {
    markAsPastEndDate( exhibition );
    removePromotionRelationships( exhibition );
    delete exhibition.isDraft;
  }

  function hasRelatedCampusResource ( exhibition ) {
    return Array.isArray( exhibition.related_campus_resources ) && exhibition.related_campus_resources.length > 0;
  }

  function removePromotionRelationships ( exhibition ) {
    delete exhibition.homepage_exhibitions_to_display;
    delete exhibition.show_on_homepage; /* replaced by control above */
    delete exhibition.news_index_exhibitions_to_display;
    delete exhibition.news_index_select_on_campus_exhibitions;
    delete exhibition.news_index_select_off_campus_exhibitions;
  }

  function markAsArchived ( exhibition ) {
    exhibition.name = isArchivedExhibition( exhibition )
      ? exhibition.name
      : isPastEndExhibition( exhibition )
        ? [ ARCHIVED_PREFIX, exhibition.name.split( PAST_END_DATE_PREFIX )[ 1 ].trim() ].join( ' ' )
        : [ ARCHIVED_PREFIX, exhibition.name ].join( ' ' )
  }

  function markAsPastEndDate ( exhibition ) {
    exhibition.name = isPastEndExhibition( exhibition )
      ? exhibition.name
      : isArchivedExhibition( exhibition )
        ? [ PAST_END_DATE_PREFIX, exhibition.name.split( ARCHIVED_PREFIX )[ 1 ].trim() ].join( ' ' )
        : [ PAST_END_DATE_PREFIX, exhibition.name ].join( ' ' )
  }
}

/**
 * Using the widget, determine which exhibitions are related to it, and depending on
 * their state, clear them from the widget or leave them.
 * 
 * @param  {array|string} widget
 * @param  {string} widgetKey
 * @param  {array} exhibitions
 * @return {object} widget
 */
function mapRelatedExhibitionsFn ( widget, widgetKey, exhibitions ) {
  assert( typeof exhibitions === 'object', 'Related data needs to be passed in to update relationship widgets.' )

  var isWidgetKeyToPreservePastEnd = PRESERVE_PAST_END_DATE_CONTROL_KEYS.indexOf( widgetKey ) !== -1;

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
    else if ( isPastEndExhibition( relatedExhibition ) && ( ! isWidgetKeyToPreservePastEnd ) ) relationship = '';
    return relationship;
  }

  function relationshipKey ( relationship ) {
    return relationship.split( ' ' )[ 1 ]
  }

  function isPopulatedRelationship ( relationship ) {
    return typeof relationship === 'string' && relationship.split( ' ' ).length === 2 && relationshipKey( relationship ).startsWith( '-' );
  }

  function emptyRowIfWidgetKeyArchived ( row ) {
    if ( ! isPopulatedRow( row ) ) return undefined;

    var rowWidget = row[ widgetKey ]

    if ( ! rowWidget ) return row;

    if ( isMultipleRelationship( rowWidget ) ) {
      // no such cases, not sure how it should be handled yet
      row[ widgetKey ] = rowWidget.map( emptyRelationshipIfArchived ).filter( isPopulatedRelationship )
      if ( ! isPopulatedMultipleRelationship( row[ widgetKey ] ) ) row = saveRowIfOthersRelated( row )
    }
    else if ( isSingleRelationship( rowWidget ) ) {
      row[ widgetKey ] = [ rowWidget ].map( emptyRelationshipIfArchived )[ 0 ]
      if ( ! isPopulatedRelationship( row[ widgetKey ] ) ) row = saveRowIfOthersRelated( row )
    }

    return row;
  }

  function saveRowIfOthersRelated ( row ) {
    // if the widget in question does not have any relationships
    // look for others that might
    // exhibitions within a grid are always found within a
    // row that includes other relationships. in an either/or
    // situation. if there are no other relationships, that
    // are populated, this row should be removed.
    var saveRow = false;
    
    Object.keys( row ).forEach( function ( rowKey ) {
      var rowValue = row[ rowKey ];
      if ( isPopulatedRelationship( rowValue ) ) saveRow = true;
      else if ( isPopulatedMultipleRelationship( rowValue ) ) saveRow = true;
    } )

    if ( saveRow === false ) row = undefined;

    return row;
  }

  function isPopulatedRow ( row ) {
    return typeof row === 'object';
  }

  function isPopulatedMultipleRelationship ( relationship ) {
    return Array.isArray( relationship ) &&
      relationship.length > 0 &&
      ( relationship.filter( isPopulatedRelationship ).length === relationship.length );
  }

  function differentRelationshipWidget ( a, b ) {
    return a.length !== b.length;
  }
}

function isArchivedExhibition ( exhibition ) {
  return typeof exhibition === 'object' && exhibition.name.startsWith( ARCHIVED_PREFIX )
}

function isPastEndExhibition ( exhibition ) {
  return typeof exhibition === 'object' && exhibition.name.startsWith( PAST_END_DATE_PREFIX )
}
