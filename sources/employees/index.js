var fs = require('fs');
var through = require('through2');
var xmlStream = require('xml-stream');

var whUtil = require('../whUtil.js')();

module.exports = Employees;

function Employees () {
    if (!(this instanceof Employees)) return new Employees();
    var self = this;
}

Employees.prototype.webhookContentType = 'employees';
Employees.prototype.webhookKeyName = 'colleague_id';
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
