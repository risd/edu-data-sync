var fs = require('fs');
var through = require('through2');
var xmlStream = require('xml-stream');

var whUtil = require('../whUtil.js')();

module.exports = Courses;


/**
 * Courses are provided via XML dump from Colleague.
 */
function Courses () {
    if (!(this instanceof Courses)) return new Courses();
    var self = this;
}

Courses.prototype.webhookContentType = 'courses';
Courses.prototype.keyFromWebhook = function (row) {
    return row.name;
};
Courses.prototype.keyFromSource = function (row) {
    return [row.COURSESYNONYM,
            row.COURSENAME].join(' ');
};

Courses.prototype.listSource = function () {
    var self = this;

    var eventStream = through.obj();

    var xml = new xmlStream(
    	fs.createReadStream(
    		__dirname + '/COURSE.DATA.XML'),
    	'iso-8859-1');

    var xmlEngl = new xmlStream(
        fs.createReadStream(
            __dirname + '/ENGL.COURSE.DATA.XML'),
        'iso-8859-1');

    var sources = [xml, xmlEngl];
    var sourcesCount = sources.length;

    // capture all departments per course

    sources.forEach(function (source) {
        source.collect('COURSE');
        source.on('endElement: DEPARTMENT', function (row) {
            row.COURSE.forEach(function (d) {
                d.departments = [row.NAME.trim()];
                eventStream.push(d);
            });
        });

        source.on('end', function () {
            sourcesCount -= 1;
            if (sourcesCount === 0) {
                eventStream.push(null);
            }
        });
    });

    return eventStream;
};

/**
 * Course data is formatted by department, instead of by
 * course name with a listing of departments that the course
 * is offered through. In order to individual courses being
 * offered through multiple departments, we need a different
 * stream process than the SyncProtocol offers.
 *
 * This one checks to see if a value exists before writing
 * it to the firebase, since duplicate entries are expected,
 * each with their own department value, which will be
 * aggregated in a single array.
 * 
 * @return through.obj stream
 */
Courses.prototype.sourceStreamToFirebaseSource = function () {
    var self = this;

    return through.obj(toFirebase);

    function toFirebase (row, enc, next) {
        var stream = this;

        var key = self.keyFromSource(row);
        // check if in firebase
        self._firebase
            .source
            .child(key)
            .once('value', onCheckComplete, onCheckError);

        // if so, see if the department needs to be added
        // if not, add it
        function onCheckComplete (snapshot) {
            var value = snapshot.val();
            if (value) {
                // value exists, see if department needs to be added
                if (value.departments.indexOf(row.departments[0]) > -1) {
                    // department is already in list
                    onAddComplete();
                } else {
                    // department needs to be added
                    value.departments =
                        value
                            .departments
                            .concat(row.departments);

                    self._firebase
                        .source
                        .child(key)
                        .set(value, onAddComplete);
                }
            } else {
                // value does not exist, add it
                self._firebase
                    .source
                    .child(key)
                    .set(row, onAddComplete);
            }
        }

        function onCheckError (error) {
            console.log(error);
            onAddComplete();
        }

        function onAddComplete () {
            stream.push(row);
            next();
        }
    }
};

Courses.prototype.updateWebhookValueWithSourceValue = function (wh, src) {
    wh.name = this.keyFromSource(src);
    wh.colleague_departments =
        src.departments
            .map(function (d) {
                return { department: d };
            });
    wh.colleague_course_title = src.COURSETITLE;
    wh.colleague_course_name = src.COURSENAME;
    wh.colleague_course_description = src.COURSEDESC;
    wh.colleague_course_term = src.COURSETERM;
    wh.colleague_course_credits = src.COURSECREDITS;
    wh.colleague_course_academic_level = src.COURSEACADEMICLEVEL;
    wh.colleague_course_faculty_id = src.COURSEFACULTY || '';

    return (whUtil.whRequiredDates(wh));
};



Courses.prototype.relationshipsToResolve = function (currentWHData) {
    var self = this;

    var toResolve = [{
        relationshipKey: 'related_departments',
        relateToContentType: 'departments',
        relateToContentTypeDataUsingKey: 'name',
        itemsToRelate: []
    }];

    if (!('colleague_departments' in currentWHData)) {
        return toResolve;
    }

    var departments =
        currentWHData.colleague_departments
            .map(function (d) {
                return {
                    departments:
                        whUtil
                            .webhookDepartmentForCourseCatalogue(
                                d.department)
                };
            })
            .filter(function (d) {
                return d.departments !== false;
            });

    toResolve[0].itemsToRelate = departments;

    return toResolve;
};
