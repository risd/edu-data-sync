module.exports = Sync;

function Sync (opts) {
    if (!(this instanceof Sync)) return new Sync(opts);
	var self = this;
}

Sync.prototype.hustle = function () {
	console.log('Every day.');
};
