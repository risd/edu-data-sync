var fs = require('fs');

var s3 = require('s3-write-stream');
var template = require('html-template');
var moment = require('moment');
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
 * Expecting an array of Sources who
 * have completed the sync.
 * 
 * Using the content type, update
 * the date associated for its
 * last update
 * 
 * @return {stream} HTML stream
 */
Report.prototype.update = function () {
	var self = this;
	return combine(
			through.obj(toUpdate),
			through.obj(writeToFirebase),
			through.obj(fetchFirebase),
			through.obj(writeHTML),
			through.obj(pushToS3));

	function toUpdate (sources, enc, next) {
		var date = moment().format('MMMM Do YYYY, h:mm:ss a');

		var keysToUpdate = {};

		sources.forEach(function (source) {
			keysToUpdate[source.webhookContentType] = date;
		});

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
							toWrite.push({
								contentType: key,
								date: value[key]
							});
						});
				}
				stream.push(toWrite);
				stream.push(null);
			});
	}

	function writeHTML (toWrite, enc, next) {
		var stream = this;
		var htmlToWrite = '';

		fs.createReadStream(__dirname + '/template.html')
			.pipe(self.html)
			.pipe(through(capture, push));

		toWrite.forEach(function (entry) {
			self.sources.write({
				'[key=contentType]': entry.contentType,
				'[key=date]': entry.date
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
		}
	}

	function pushToS3 (html, enc, next) {
		var stream = this;

		var source = through();
		var upload = s3({
			accessKeyId: process.env.AWS_KEY,
			secretAccessKey: process.env.AWS_SECRET,
			Bucket: 'edu-data-sync-report',
			ContentType: 'text/html'
		});

		var writer = source.pipe(upload('index.html'));

		writer
			.on('end', function () {
				stream.push(html);
				stream.push(null);
			});

		console.log(html);
		source.write(Buffer(html));
		source.end();
	}
};
