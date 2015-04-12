var fs = require('fs');
var through = require('through2');
var xmlStream = require('xml-stream');

var whUtil = require('../whUtil.js')();

module.exports = Employees;


/**
 * Employees are provided via XML dump from Colleague.
 */
function Employees () {
    if (!(this instanceof Employees)) return new Employees();
    var self = this;
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

    var xml = new xmlStream(
    	fs.createReadStream(
    		__dirname + '/EMPLOYEE.DATA.XML'));

    xml.on('endElement: EMPLOYEE', function (d) {
    	eventStream.push(d);
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
        relateToContentTypeDataUsingKey: 'name',
        itemsToRelate: false
    }, {
        multipleToRelate: false,
        relationshipKey: 'related_graduate_studies',
        relateToContentType: 'graduatestudies',
        relateToContentTypeDataUsingKey: 'name',
        itemsToRelate: false
    }];
};

Employees.prototype.dataForRelationshipsToResolve = function (currentWHData) {
    var self = this;

    var toResolve = self.relationshipsToResolve();

    if ('colleague_department' in currentWHData) {
        var department = whUtil
            .webhookDepartmentForColleague(
                currentWHData.colleague_department);

        if (department !== false) {
            toResolve[0].itemsToRelate = [{
                departments: department
            }];
        }

        if (currentWHData.colleague_department ===
            'Foundation Studies') {
            // console.log('Course is in Foundation Studies.');
            toResolve[1].itemToRelate = true;
        }

        if (currentWHData.colleague_department ===
            'Graduate Studies') {
            // console.log('Course is in Graduate Studies.');
            toResolve[2].itemToRelate = true;
        }
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
