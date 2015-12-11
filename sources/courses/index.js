var fs = require('fs');
var through = require('through2');
var xmlStream = require('xml-stream');
var knox = require('knox');
var cheerio = require('cheerio');

var whUtil = require('../whUtil.js')();

module.exports = Courses;


/**
 * Courses are provided via XML dump from Colleague.
 */
function Courses () {
    if (!(this instanceof Courses)) return new Courses();
    var self = this;
    this.aws = knox.createClient({
        key: process.env.AWS_KEY,
        secret: process.env.AWS_SECRET,
        bucket: 'from-oit-for-edu'
    });
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
    console.log('Courses.listSource::start');

    var eventStream = through.obj();

    var seed = through.obj();

    seed.pipe(s3Stream())
        .pipe(drainXMLResIntoStream(eventStream));

    var sources = ['ENGL.COURSE.DATA.XML',
                   'COURSE.DATA.XML'];
    var sourcesCount = sources.length;

    sources.forEach(function (source) {
        seed.push(source);
    });
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

            // capture all departments per course
            xml.collect('COURSE');
            xml.on('error', function (err) {
                writeStream.emit('error', err);
            });
            xml.on('endElement: DEPARTMENT', function (row) {
                row.COURSE.forEach(function (d) {
                    d.departments = [row.NAME.trim()];
                    writeStream.push(d);
                });
            });

            xml.on('end', function () {
                sourcesCount -= 1;
                if (sourcesCount === 0) {
                    console.log('Courses.listSource::end');
                    writeStream.push(null);
                    stream.push(null);
                }
                else {
                    next();
                }
            });
        }
    }
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
                    var departments =
                        value
                            .departments
                            .concat(row.departments);

                    self._firebase
                        .source
                        .child(key)
                        .child('departments')
                        .set(departments, onAddComplete);
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
            stream.emit('error', error);
            onAddComplete();
        }

        function onAddComplete () {
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
    wh.colleague_course_title = toTitleCase(src.COURSETITLE);
    wh.colleague_course_name = src.COURSENAME;
    wh.colleague_course_description = formatDescription(src.COURSEDESC);
    wh.colleague_course_term = src.COURSETERM;
    wh.colleague_course_credits = src.COURSECREDITS;
    wh.colleague_course_academic_level = src.COURSEACADEMICLEVEL;
    wh.colleague_course_faculty_id = src.COURSEFACULTY || false;

    return (whUtil.whRequiredDates(wh));

    function toTitleCase (str) {
        return str.replace(
                    /\w\S*/g,
                    function (txt) {
                        return txt.charAt(0)
                                  .toUpperCase() +
                               txt.substr(1)
                                  .toLowerCase();
                    }
                )
                .replace(/ Iii/g, ' III')
                .replace(/ Ii/g,  ' II');
    }

    function formatDescription (desc) {
        return [desc]
            .map(replaceBrWithP)
            .map(ensureWrapInP)
            .map(ensureValid)
            [0];

        function ensureWrapInP (body) {
            if (body.length === 0) {
                return body;
            }
            if (!(body.indexOf('<p>') === 0)) {
                body = '<p>' + body;
            }
            if (!(body.indexOf('</p>') === (body.length - 5))) {
                body = body + '</p>';   
            }
            return body;
        }

        function replaceBrWithP (body) {
            return body
                .replace(/<br>/g, '</p><p>')
                .replace(/<BR>/g, '</p><p>');
        }

        function ensureValid (body) {
            var $ = cheerio.load('<div class="top">' + body + '</div>');
            return $('.top').html();
        }
    }
};

Courses.prototype.relationshipsToResolve = function () {
    /*
    mutlipleToRelate: boolean
        Are we relating to a one-off or
        mutliple entry content-type
    relationshipKey: string
        What is the name of the key in the
        Course object that is being used to
        store any relationships that are made
    relateToContentType
        The name of the content-type that we
        are creating a relationship to. This is
        the webhook name. All lowercase, no spaces
        or hyphens.
    relateToContentTypeDataUsingKey
        The key in the webhook object that we
        are seeing if we have a relationship to.
        Only used for multiple content-type
        relationships
    itemsToRelate
        The webhook relationship values that
        should be added to the relationshipKey
        for this webhook Course object.
        This will take the form of an array
        with an object that has a key of the
        content-type to compare against,
        and the value of the Course object's
        `relateToContentTypeDataUsingKey` value

     */
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
    }, {
        multipleToRelate: true,
        relationshipKey: 'related_employees',
        relateToContentType: 'employees',
        relateToContentTypeDataUsingKey: 'colleague_id',
        itemsToRelate: []
    }];
};


Courses.prototype.dataForRelationshipsToResolve = function (currentWHData) {
    var self = this;

    var toResolve = self.relationshipsToResolve();

    if ('colleague_departments' in currentWHData) {
        var departments =
            currentWHData.colleague_departments
                .map(function (d) {
                    return d.department;
                })
                .map(whUtil.webhookDepartmentForCourseCatalogue)
                .filter(function (d) {
                    return d !== false;
                })
                .map(function (d) {
                    return { departments: d };
                });

        toResolve[0].itemsToRelate = departments;

        var foundation =
            currentWHData.colleague_departments
                .filter(function (d) {
                    return d.department ===
                           'FOUNDATION STUDIES';
                });

        if (foundation.length === 1) {
            toResolve[1].itemToRelate = true;
        }

        var graduate =
            currentWHData.colleague_departments
                .filter(function (d) {
                    return d.department ===
                           'GRADUATE STUDIES';
                });

        if (graduate.length === 1) {
            toResolve[2].itemToRelate = true;
        }

        var liberalArtsDepartments =
            currentWHData.colleague_departments
                .map(function (d) {
                    return d.department;
                })
                .map(whUtil
                        .webhookLiberalArtsDepartmentForCourseCatalogue)
                .filter(function (d) {
                    return d !== false;
                })
                .map(function (d) {
                    return { liberalartsdepartments: d };
                });

        toResolve[3].itemsToRelate = liberalArtsDepartments;
    }

    if ('colleague_course_faculty_id' in currentWHData) {
        if (currentWHData.colleague_course_faculty_id) {
            toResolve[4].itemsToRelate = [{
                employees: currentWHData.colleague_course_faculty_id
            }];
        }
    }

    return toResolve;
};
