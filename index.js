var util = require('./util.js');

module.exports = Sync;

function Sync (opts) {
    if (!(this instanceof Sync)) return new Sync(opts);
	var self = this;

	this.config = util.config();
	console.log(this.config);
}

Sync.prototype.hustle = function () {
	console.log('Every day.');
};