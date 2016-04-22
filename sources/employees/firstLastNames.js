// Initializing any sync source will attempt to
// make a connection to s3, where the source
// files are stored.
process.env.AWS_KEY = 'key';
process.env.AWS_SECRET = 'secret';

var through = require('through2');

var Employee = require('./index.js')();
var path = __dirname +
          '/EMPLOYEE.DATA.2016-04-06--12:14:11.XML';

Employee.listSourceLocal(path)
  .pipe(names())
  .pipe(stringify())
  .pipe(process.stdout);

function stringify () {
  return through.obj(function (row, enc, next) {
    this.push(JSON.stringify(row) + "\n");
    next();
  });
}

function names () {
  return through.obj(function (row, enc, next) {
    var s = Employee.updateWebhookValueWithSourceValue({}, row);
    this.push({
      first: row.FIRSTNAME,
      middle: row.MIDDLENAME,
      last: row.LASTNAME,
      preferred: row.PREFERREDNAME,
      person: s.colleague_person
    })
    next();
  })
}