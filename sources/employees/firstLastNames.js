process.env.AWS_KEY = 'aye';
process.env.AWS_SECRET = 'girl';

var through = require('through2');

var Employee = require('./index.js')();
var path = __dirname +
          '/EMPLOYEE.DATA.2016-01-25--16:52:24.XML';

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