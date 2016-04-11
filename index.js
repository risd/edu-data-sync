var through = require('through2');
var pump = require('pump');

var Report = require('../report/index.js');


var Firebaseref = require('./firebaseref.js');

module.exports = Sync;

function Sync (opts) {
  if (!(this instanceof Sync)) return new Sync(opts);

  var sourcePrototypes = [];

  if (opts.events) {
    sourcePrototypes.push(require('./sources/events/index.js'));
  }
  if (opts.employees) {
    sourcePrototypes.push(require('./sources/employees/index.js'));
  }
  if (opts.courses) {
    sourcePrototypes.push(require('./sources/courses/index.js'))
  }

  var self = this;
}


