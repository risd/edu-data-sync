var fs = require('fs');
var template = require('html-template');
var moment = require('moment');
var request = require('request');

module.exports = Report;

/**
 * Report. A static HTML file that gets updated
 * on S3 that is based on the sync process having
 * run, and updating the Firebase node.
 * 
 * @param {Function}
 */
function Report () {
    if (!(this instanceof Report)) return new Report();
    var self = this;
    var html = template();
    this.sources = html.template('source');
}

/**
 * Configures this._firebase. The root of 
 * the report data.
 * @type {[type]}
 */
Report.prototype.configFirebase = function () {
	var self = this;
	var pathOnFirebase = 'eduSyncReport';
	// setup s3
	return through.obj(function (fb, enc, next) {
		var stream = this;
		self._firebase = fb.child(pathOnFirebase);

		// Get pathOnFirebase to make sure it exists.
		self._firebase
			.once('value', function (snapshot) {
				var value = snapshot.val();
				if (value) {
					done();
				} else {
					makeKey(pathOnFirebase);
				}
			});

		// If it doesn't, make it.
		function makeKey (key) {
            self._firebase
                .set({}, function () {
                    done();
                });
        }

		function done () {
			stream.push(fb);
			stream.push(null);
		}
	});
};

/**
 * Fetch gets the report data from Firebase.
 *
 * Pushes an array to write to the template.
 *
 * [{ contentType: , updated: '' }]
 * 
 * @return {stream}
 */
Report.prototype.fetch = function () {
	return through.obj(ftch);

	function ftch (row, enc, next) {

	}
};

/**
 * Expecting a stream of HTML.
 * 
 * Using the content type, update
 * the date associated for its
 * last update
 * 
 * @return {stream} HTML stream
 */
Report.prototype.update = function () {
	var self = this;
	return through.obj(updt);

	function updt (row, enc, next) {
		self.write({
			'[key=contentType]': '',
			'[key=updated]': ''
		});
	}
};

/**
 * Expecting a stream of HTML
 * @return {[type]} [description]
 */
Report.prototype.put = function () {
	return through.obj(pt);

	function pt (row, enc, next) {

	}
};