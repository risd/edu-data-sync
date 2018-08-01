var debug = require('debug')('employees');
var fs = require('fs');
var through = require('through2');
var xmlStream = require('xml-stream');
var knox = require('knox');

var whUtil = require('../whUtil.js')();

module.exports = Employees;

/**
 * Employees are provided via XML dump from Colleague.
 */
function Employees ( options ) {
    if (!(this instanceof Employees)) return new Employees( options );
    var self = this;
    this.aws = knox.createClient( options.aws );
}

Employees.prototype.webhookContentType = 'employees';
Employees.prototype.keyFromWebhook = function (webhookItem) {
    return webhookItem.colleague_id;
};
Employees.prototype.keyFromSource = function (sourceItem) {
    return sourceItem.ID;
};
// Employees.prototype.secondaryKeyComparison = function (row, callback) {
    
//     // row = { source, srcKey, webhook, whKey }
//     // return true if
//     //     source.PREFERREDNAME === webhook.name
//     //     if webhook.colleague_department
//     //         source.DEPARTMENT === webhook.colleague_department;
    
//     // only compare if there is no primary key value
//     if (isStringWithLength(this.keyFromWebhook(row.webhook))) {
//         return callback(null, false)
//     }

//     if ( row.source.PREFERREDNAME === row.webhook.name ) {
//         // if names are the same, ensure departments are also the same
//         if (isStringWithLength(row.webhook.colleague_department)) {
//             if (whUtil.allColleagueDepartments.indexOf(row.source.DEPARTMENT) > -1) {
//                 if (row.webhook.colleague_department === row.source.DEPARTMENT) {
//                     return callback(null, true);
//                 } else {
//                     return callback(null, false);
//                 }
//             } else {
//                 // Not a tracked department, we only have the name match to go off of
//                 return callback(null, true);
//             }
//         } else {
//             // employee is not related to other departments, so we can
//             // not make a secondary match. their names match, and thats all we
//             // need to confirm the match
//             return callback(null, true);
//         }
//     }
//     else {
//         return callback(null, false)
//     }
// };

Employees.prototype.listSource = function () {
	debug('listSource');
    var self = this;

    var eventStream = through.obj();

    var seed = through.obj();

    seed.pipe(s3Stream())
        .pipe(drainXMLResIntoStream(eventStream));

    seed.push('EMPLOYEE.DATA.XML');
    seed.push(null);

    return eventStream;

    function s3Stream() {
        return through.obj(s3ify);

        function s3ify (path, enc, next) {
            var stream = this;

            self.aws
                .getFile(path, function (err, res) {
                    if (err) {
                        stream.emit('error', err);
                    } else {
                        stream.push(res);    
                    }
                    
                    next();
                });
        }
    }

    function drainXMLResIntoStream (writeStream) {
        return through.obj(drain);

        function drain (res, enc, next) {
            var stream = this;
            var xml = new xmlStream(res, 'iso-8859-1');

            xml.on('error', function (err) {
                writeStream.emit('error', err);
            });

            xml.on('endElement: EMPLOYEE', function (d) {
                if ( typeof d.SABBATICAL === 'object' && typeof d.SABBATICAL['$'] === 'object' )  {
                    d.SABBATICAL = d.SABBATICAL['$']
                }
                writeStream.push(d);
            });

            xml.on('end', function () {
                debug('listSource::end');
                writeStream.push(null);
                stream.push(null);
            });
        }
    }
};

Employees.prototype.listSourceLocal = function (path) {
    debug('listSourceLocal');
    var self = this;

    var eventStream = through.obj();

    var file = fs.createReadStream(path);

    var xml = new xmlStream(file, 'iso-8859-1');

    xml.on('endElement: EMPLOYEE', function (d) {
        eventStream.push(d);
    });

    xml.on('error', function (e) {
        eventStream.emit('error', e);
    });

    xml.on('end', function () {
        debug('Employees.listSource::end');
        eventStream.push(null);
    });

    return eventStream;
};

Employees.prototype.updateWebhookValueWithSourceValue = function (wh, src) {
    wh.name = src.PREFERREDNAME;
    wh.colleague_id = src.ID;
    wh.colleague_person = {
    	first: src.FIRSTNAME.trim(),
    	last: src.LASTNAME.trim()
    };

    var firstInPreferred = (src.FIRSTNAME.length > 0) ? src.PREFERREDNAME.indexOf(src.FIRSTNAME) : -1;
    var nicknameInPreferred = (src.NICKNAME.length > 0) ? src.PREFERREDNAME.indexOf(src.NICKNAME) : -1;
    var middleInPreferred = (src.MIDDLENAME.length > 0) ? src.PREFERREDNAME.indexOf(src.MIDDLENAME) : -1;
    var lastInPreferred = (src.LASTNAME.length > 0) ? src.PREFERREDNAME.indexOf(src.LASTNAME) : -1;

    if ((firstInPreferred > -1) &&
        (lastInPreferred > -1)) {
        // names are correct
    } else if (
        (firstInPreferred > -1) &&
        (middleInPreferred > -1) &&
        (lastInPreferred === -1)) {
        if (firstInPreferred === 0) {
            wh.colleague_person.last = src.PREFERREDNAME
                .slice(
                    middleInPreferred,
                    src.PREFERREDNAME.length)
                .trim();
        }
        else {
            /* we can't reliably set first/last */
        }
    } else if (
        (firstInPreferred === -1) &&
        (middleInPreferred > -1) &&
        (lastInPreferred > -1)) {
        if ((middleInPreferred === 0) &&
            (lastInPreferred + src.LASTNAME.length) === src.PREFERREDNAME.length) {
            wh.colleague_person.first = src.PREFERREDNAME
                .slice(
                    0,
                    src.MIDDLENAME.length)
                .trim();
        }
        else {
            /* we can't reliably set first/last */
        }
    } else if (
        (firstInPreferred > -1) &&
        (middleInPreferred === -1) &&
        (lastInPreferred === -1)) {
        if (firstInPreferred === 0) {
            wh.colleague_person = {
                first: src.FIRSTNAME.trim(),
                last: src.PREFERREDNAME
                    .slice(
                        src.FIRSTNAME.length,
                        src.PREFERREDNAME.length)
                    .trim()
            }
        }
        else if ((firstInPreferred + src.FIRSTNAME.length) === src.PREFERREDNAME.length) {
            wh.colleague_person = {
                first: src.PREFERREDNAME
                    .slice(
                        0,
                        src.FIRSTNAME.length)
                    .trim(),
                last: src.FIRSTNAME.trim()
            }
        }
        else {
            /* we can't reliably set first/last */
        }
    } else if (
        (firstInPreferred === -1) &&
        (middleInPreferred > -1) &&
        (lastInPreferred === -1)) {
        if (middleInPreferred === 0) {
            wh.colleague_person = {
                first: src.MIDDLENAME.trim(),
                last: src.PREFERREDNAME
                    .slice(
                        src.MIDDLENAME.length,
                        src.PREFERREDNAME.length)
                    .trim()
            }
        }
        else if ((middleInPreferred + src.MIDDLENAME.length) === src.PREFERREDNAME.length) {
            wh.colleague_person = {
                first: src.PREFERREDNAME
                    .slice(
                        0,
                        middleInPreferred)
                    .trim(),
                last: src.PREFERREDNAME
                    .slice(
                        middleInPreferred,
                        src.PREFERREDNAME.length)
                    .trim()
            }   
        }
        else {
            /* we can't reliably set first/last */
        }
    } else if (
        (firstInPreferred === -1) &&
        (middleInPreferred === -1) &&
        (lastInPreferred > -1)) {
        if ((src.PREFERREDNAME.length - src.LASTNAME.length) === lastInPreferred) {
            wh.colleague_person.first = src.PREFERREDNAME
                .slice(
                    0,
                    lastInPreferred)
                .trim()
        }
        else if (lastInPreferred === 0) {
            wh.colleague_person = {
                first: src.LASTNAME.trim(),
                last: src.PREFERREDNAME
                    .slice(
                        src.LASTNAME.length,
                        src.PREFERREDNAME.length)
                    .trim()
            }
        }
        else {
            /* we can't reliably set first/last */
        }
    }



    wh.colleague_email = src.EMAIL;
    wh.colleague_phone_number = src.PHONE;
    wh.colleague_title = src.TITLE;
    wh.colleague_department = src.DEPARTMENT;
    wh.colleague_institutions_attended =
    	src.INSTITUTIONSATTENDED.split( ';' )
            .map( function ( institution ) {
                return { institution: institution.trim() }
            } )
            .sort( function ( a, b ) {
                return a.institution < b.institution
                    ? -1
                    : a.institution > b.institution
                        ? 1
                        : 0;
            } );

    wh.sabbatical_start_date = typeof src.SABBATICAL === 'object' ? src.SABBATICAL[ 'start-date' ] : '' ;
    wh.sabbatical_end_date = typeof src.SABBATICAL === 'object' ? src.SABBATICAL[ 'end-date' ] : '' ;

    wh.colleague_status = true;
    wh.manual_entry = false;

    wh.colleague_organizations = src.CORG
        .split('; ')
        .filter(function (org) {
            return org.length > 0;
        })
        .map(function (org) {
            return { name: org };
        });

    return wh;
};

Employees.prototype.relationshipsToResolve = function () {
    return [{
        multipleToRelate: true,
        relationshipKey: 'related_departments',
        relateToContentType: 'departments',
        relateToContentTypeDataUsingKey: 'name',
        itemsToRelate: []
    }, {
        multipleToRelate: false,
        relationshipKey: 'related_foundation_studies',
        relateToContentType: 'experimentalandfoundationstudies',
        itemToRelate: false
    }, {
        multipleToRelate: false,
        relationshipKey: 'related_graduate_studies',
        relateToContentType: 'graduatestudies',
        itemToRelate: false
    }, {
        multipleToRelate: true,
        relationshipKey: 'related_liberal_arts_departments',
        relateToContentType: 'liberalartsdepartments',
        relateToContentTypeDataUsingKey: 'name',
        itemsToRelate: []
    }];
};

Employees.prototype.dataForRelationshipsToResolve = function (currentWHData) {
    var self = this;

    var toResolve = self.relationshipsToResolve();

    if ('colleague_department' in currentWHData) {
        var departments = [currentWHData.colleague_department]
            .map(whUtil.webhookDepartmentForColleague)
            .filter(function (d) {
                return d !== false;
            })
            .map(function (d) {
                return { departments: d };
            });

        toResolve[0].itemsToRelate = departments;

        if (currentWHData.colleague_department === whUtil.colleagueFoundationStudies) {
            // debug('Course is in Foundation Studies.');
            toResolve[1].itemToRelate = true;
        }

        if (currentWHData.colleague_department === whUtil.colleagueGraduateStudies) {
            // debug('Course is in Graduate Studies.');
            toResolve[2].itemToRelate = true;
        }

        var liberalArtsDepartments =
            [currentWHData.colleague_department]
                .map(whUtil.webhookLiberalArtsDepartmentForColleague)
                .filter(function (d) {
                    return d !== false;
                })
                .map(function (d) {
                    return { liberalartsdepartments: d };
                });
        
        toResolve[3].itemsToRelate = liberalArtsDepartments;
    } else if ( currentWHData.manual_entry === true ) {
        // this is a manual entry, don't mess with it
        return [];
    }

    return toResolve;
};


/**
 * `updateWebhookValueNotInSource` implementation
 * for employees. If they are in Webhook & not in
 * source, there is an active flag that gets switched
 * from off to on.
 * 
 * @return {stream} through.obj transform stream
 */
Employees.prototype.updateWebhookValueNotInSource = function () {
    var self = this;
    return through.obj(updateNotInSource);

    function updateNotInSource (row, enc, next) {
        var stream = this;
        var dirty = false;

        // sync overrides, set the appropriate colleague_status
        if ('manual_removal' in row.webhook && row.webhook.manual_removal === true) {
            // manual removel sync over ride
            row.webhook.colleague_status = false;
            dirty = true;

            if (row.inSource === false) {
                row.webhook.manual_removal = false;
            }
        }
        else if ('manual_entry' in row.webhook && row.webhook.manual_entry === true) {
            // manual entry sync override
            row.webhook.colleague_status = true;
            dirty = true;

            if (row.inSource === true) {
                // the person is in the feed now, so we can turn this off
                // future synchronizations don't need to lean on this
                row.webhook.manual_entry = false;
            }
        }
        else {
            // no sync overrides
            // if they are not in the feed, lets make sure they
            // have the correct colleague status
            if (row.inSource === false) {
                if (row.webhook.colleague_status === true) {
                    row.webhook.colleague_status = false;
                    dirty = true;
                }
            }
        }

        // update the webhook object based on its colleauge_status
        if (row.webhook.colleague_status === true) {
            if (row.webhook.isDraft === true) {
                row.webhook.isDraft = false;
                dirty = true;
            }
        }
        else if (row.webhook.colleague_status === false) {
            if (row.webhook.isDraft === false) {
                row.webhook.isDraft = true;
                dirty = true;
            }
        }

        if (dirty) {
            self._firebase
                .webhook
                .child(row.whKey)
                .set(row.webhook, function () {
                    next();
                });
        } else {
            next();
        }
    }
};

function isArrayWithLength (value) {
    return ( value && Array.isArray(value) && value.length > 0 );
}

function isStringWithLength( value ) {
    return ( typeof value === 'string' ) && ( value.trim().length > 0 );
}
