module.exports = Report;

/**
 * Report. Updates an HTML document hosted
 * on S3 with the current timestamp. Will be
 * used to check when the last sync of any
 * particular content-type occured.
 * 
 * @param {Function} contentType Takes the
 * name of the content type that was just
 * updated.
 */
function Report (contentType) {
    if (!(this instanceof Report)) return new Report(contentType);
    var self = this;
    if (!(contentType)) {
    	throw new Error('Requires a content type to report on.');
    }
    this.contentType = contentType;
}

/**
 * Configures the S3 object
 * @type {[type]}
 */
Report.prototype.config = function () {
	// setup s3
	var t = through.obj();
	return t;
};

/**
 * Fetch gets the report document from s3
 * 
 * @return {stream} HTML stream
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
	return through.obj(updt);

	function updt (row, enc, next) {

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