var fs = require('fs');

var knox = require('knox');
var template = require('html-template');
var moment = require('moment');
var timezone = require('moment-timezone');
var request = require('request');
var through = require('through2');
var combine = require('stream-combiner2');


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
    this.html = template();
    this.sources = this.html.template('source');
    this.templateStream = function () {
    	return fs.createReadStream(
    		__dirname + '/template.html');
    };
}

/**
 * Configures this._firebase. The root of 
 * the report data.
 *
 * Expects a reference to the firebase,
 * pushes that same reference to the firebase.
 */
Report.prototype.config = function () {
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
 * Expecting an array of Sources to
 * flow through one at a time
 * 
 * Using the content type, update
 * the date associated for its
 * last update.
 *
 * When the source has been updated, the
 * source is pushed along in the stream.
 * 
 * @return {stream} Sources stream
 */
Report.prototype.update = function () {
	var self = this;

	return through.obj(processSource);

	function processSource (source, enc, next) {
    var nowOnEastCoast = timezone().tz('America/New_York');
	  var date = moment(nowOnEastCoast).format('MMMM Do YYYY, h:mm:ss a');

    var keysToUpdate = {};
    keysToUpdate[source.webhookContentType] = {
      date: date,
      errors: source.errors
    };

    var update = combine(
      through.obj(toUpdate),
      through.obj(writeToFirebase),
      through.obj(fetchFirebase),
      through.obj(writeHTML),
      through.obj(pushToS3));

    update.on('error', function (error) {
      console.error('Failed to update the report for the source.');
      console.error(error);
      source.errors.push(error);
      next(null, source);
    });
    update.on('finish', function () {
      next(null, source);
    });

    update.write(source);
    update.end();
	}

	function toUpdate (source, enc, next) {
		var nowOnEastCoast = timezone().tz('America/New_York');
		var date = moment(nowOnEastCoast).format('MMMM Do YYYY, h:mm:ss a');

		var keysToUpdate = {};
		keysToUpdate[source.webhookContentType] = {
			date: date,
			errors: source.errors
		};

		this.push(keysToUpdate);
		this.push(null);
	}

	function writeToFirebase (toUpdate, enc, next) {
		var stream = this;

		self._firebase
			.update(toUpdate, function (error) {
				if (error) {
					var m = 'Error writing report data ' +
							'to Firebase.';
					console.log(m);
				}
				stream.push(toUpdate);
				stream.push(null);
			});
	}

	function fetchFirebase (toUpdate, enc, next) {
		var stream = this;
		var toWrite = [];

		self._firebase
			.once('value', function (snapshot) {
				var value = snapshot.val();
				if (value) {
					Object.keys(value)
						.forEach(function (key) {
							var v = {
								contentType: key
							};
							v.date = value[key].date;
							if ('errors' in value[key]) {
								v.errors = value[key].errors
									.map(function (d) {
										return '<li>' + d.message + '</li>';
									});
							}
							else {
								v.errors = '';
							}

							v.sortDate = moment(
									v.date,
									'MMMM Do YYYY, h:mm:ss a'
								)
								.valueOf();

							toWrite.push(v);
						});
				}
				stream.push(toWrite);
				stream.push(null);
			});
	}

	function writeHTML (toWrite, enc, next) {
		var stream = this;
		var htmlToWrite = '';

		var sortedToWrite = toWrite.sort(function (a, b) {
				return b.sortDate - a.sortDate;
			});

		self.templateStream()
			.pipe(self.html)
			.pipe(through(capture, push));

		sortedToWrite.forEach(function (entry) {
			self.sources.write({
				'[key=contentType]': entry.contentType,
				'[key=date]': entry.date,
				'[key=errors]': entry.errors
			});
		});

		self.sources.end();

		function capture (chunk, subenc, subnext) {
			htmlToWrite += chunk.toString();
			subnext();
		}
		function push () {
			stream.push(htmlToWrite);
			stream.push(null);
			this.push(null);
		}
	}

	function pushToS3 (html, enc, next) {
		var stream = this;

		var client = knox.createClient({
			key: process.env.AWS_KEY,
			secret: process.env.AWS_SECRET,
			bucket: 'edu-data-sync-report'
		});

		var req = client.put('/index.html', {
			'Content-Length': Buffer.byteLength(html),
			'Content-Type': 'text/html'
		});

		req.on('response', function (res) {
			if (200 == res.statusCode) {
				console.log('Report saved to: ', req.url);
			}
			next();
		});

		req.end(html);
	}
};
