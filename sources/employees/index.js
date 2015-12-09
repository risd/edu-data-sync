var fs = require('fs');
var through = require('through2');
var xmlStream = require('xml-stream');
var knox = require('knox');

var whUtil = require('../whUtil.js')();

module.exports = Employees;


/**
 * Employees are provided via XML dump from Colleague.
 */
function Employees () {
    if (!(this instanceof Employees)) return new Employees();
    var self = this;
    this.aws = knox.createClient({
        key: process.env.AWS_KEY,
        secret: process.env.AWS_SECRET,
        bucket: 'from-oit-for-edu'
    });
}

Employees.prototype.webhookContentType = 'employees';
Employees.prototype.keyFromWebhook = function (row) {
    return row.colleague_id;
};
Employees.prototype.keyFromSource = function (row) {
    return row.ID;
};

Employees.prototype.listSource = function () {
	console.log('Employees.listSource');
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
                        console.error(err);
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
                next(err, null);
            });

            xml.on('endElement: EMPLOYEE', function (d) {
                console.log(d);
                d.corg = c.corg.split('; ');
                writeStream.push(d);
            });

            xml.on('end', function () {
                console.log('Employees.listSource::end');
                writeStream.push(null);
                stream.push(null);
            });
        }
    }
};

Employees.prototype.listSourceLocal = function () {
    console.log('Employees.listSourceLocal');
    var self = this;

    var eventStream = through.obj();

    var file = fs.createReadStream(
                        __dirname +
                        '/EMPLOYEE.DATA.XML');

    var xml = new xmlStream(file, 'iso-8859-1');

    xml.on('endElement: EMPLOYEE', function (d) {
        eventStream.push(d);
    });

    xml.on('error', function (e) {
        console.log(e);
    });

    xml.on('end', function () {
        console.log('Employees.listSource::end');
        eventStream.push(null);
    });

    return eventStream;
};

Employees.prototype.updateWebhookValueWithSourceValue = function (wh, src) {
	wh.name = src.PREFERREDNAME;
    wh.colleague_id = src.ID;
    wh.colleague_person = {
    	first: src.FIRSTNAME,
    	last: src.LASTNAME
    };
    wh.colleague_email = src.EMAIL;
    wh.colleague_phone_number = src.PHONE;
    wh.colleague_title = src.TITLE;
    wh.colleague_department = src.DEPARTMENT;
    wh.colleague_institutions_attended =
    	src.INSTITUTIONSATTENDED;

    wh.colleague_status = true;

    wh.colleague_organizations = src.corg
        .map(function (d) {
            return { name: d };
        });

    return (whUtil.whRequiredDates(wh));
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
        relateToContentType: 'foundationstudies',
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

        if (currentWHData.colleague_department ===
            'Division of Foundation Studies') {
            // console.log('Course is in Foundation Studies.');
            toResolve[1].itemToRelate = true;
        }

        if (currentWHData.colleague_department ===
            'Graduate Studies') {
            // console.log('Course is in Graduate Studies.');
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

        if (!('colleague_status' in row.webhook)) {
            row.webhook.colleague_status = false;
            dirty = true;
        }
        
        if (row.inSource === false) {
            if (row.webhook.colleague_status === true) {
                row.webhook.colleague_status = false;
                dirty = true;
            }
        } else {
            if (row.webhook.colleague_status === false) {
                row.webhook.colleague_status = true;
                dirty = true;
            }
        }

        if (dirty) {
            self._firebase
                .webhook
                .child(row.whKey)
                .set(row.webhook, function () {
                    stream.push(row);
                    next();
                });
        } else {
            this.push(row);
            next();
        }
    }
};
