var fs = require('fs');
var through = require('through2');
var xmlStream = require('xml-stream');
var moment = require('moment');

var whUtil = require('../whUtil.js')();

module.exports = News;

/**
 * News are provided via XML dump from Ektron.
 * This will only need to be done in order to
 * suppor the transition from Ektron to WebHook.
 */
function News () {
	if (!(this instanceof News)) return new News();
}

News.prototype.webhookContentType = 'news';
News.prototype.keyFromWebhook = function (row) {
	return row.ektron_id;
};
News.prototype.keyFromSource = function (row) {
	return row.ContentID;
};

News.prototype.listSource = function () {
	console.log('News.listSource');
	var self = this;

	var eventStream = through.obj();

	var xml = new xmlStream(
		fs.createReadStream(__dirname + '/news2010.xml'));

	var valueForThumbimage = HTMLValueForTag('thumbimage');
	var valueForBody = HTMLValueForTag('body');

	xml.on('endElement: NewsItem', function (d) {
		d.thumbimage = valueForThumbimage(d.HMTL);
		d.body = valueForBody(d.HMTL);
		d.tags = [d.TaxonomyName];
		// console.log(d);
		eventStream.push(d);
	});

	xml.on('end', function () {
		console.log('News.listSource::end');
		eventStream.push(null);
	});


	return eventStream;

	function HTMLValueForTag (tag) {
		return function (html) {
			var value = '';
			var splitStart = html.split('<' + tag + '>');
			if (splitStart.length > 0) {
				var splitEnd = splitStart[1].split('</' + tag + '>');
				value = splitEnd[0];
			}
			return value;
		};
	}
};

/**
 * News items are duplicated throughout the feed, with
 * a unique id, each of which captures one of the taxonomy
 * names that the item has assocaited with it.
 *
 * This function checks to see if the current row exists
 * in the firebase, and appends the current taxonomy name
 * to the entry when it already exists.
 * 
 * @return {through.obj} Stream of objects.
 */
News.prototype.sourceStreamToFirebaseSource = function () {
	var self = this;

	return through.obj(toFirebase);

	function toFirebase (row, enc, next) {
		var stream = this;

		var key = self.keyFromSource(row);
		self._firebase
			.source
			.child(key)
			.once('value', onCheckComplete, onCheckError);

		function onCheckComplete (snapshot) {
			var value = snapshot.val();
			if (value) {
				if (value.tags.indexOf(row.tags[0]) > -1) {
					onAddComplete();
				} else {
					var tags = value.tags.concat(row.tags);

					self._firebase
						.source
						.child(key)
						.child('tags')
						.set(tags, onAddComplete);
				}
			} else {
				self._firebase
					.source
					.child(key)
					.set(row, onAddComplete);
			}
		}

		function onCheckError (error) {
            console.log(error);
            onAddComplete();
        }

        function onAddComplete () {
            stream.push(row);
            next();
        }

	}
};

News.prototype.updateWebhookValueWithSourceValue = function (wh, src) {
	wh.name = src.Title;
	wh.ektron_id = this.keyFromSource(src);
	wh.body = src.body;
	wh.ektron_tags = src.tags;

	// These carry dates that we want to maintain
	wh.create_date = moment(src.CreatedDate).format();
	wh.publish_date = moment(src.EditDate).format();
	wh.last_updated = moment(src.EditDate).format();
	wh._sort_create_date = moment(src.CreatedDate).unix();
	wh._sort_last_updated = moment(src.EditDate).unix();
	wh._sort_publish_date = moment(src.EditDate).unix();
	wh.preview_url = whUtil.guid();

	return wh;
};

News.prototype.relationshipsToResolve = function () {
    return [{
        multipleToRelate: true,
        relationshipKey: 'related_departments',
        relateToContentType: 'departments',
        relateToContentTypeDataUsingKey: 'name',
        itemsToRelate: []
    }, {
        multipleToRelate: false,
        relationshipKey: 'related_foundation_studies',
        relateToContentType: 'foundationstudies',
        relateToContentTypeDataUsingKey: 'name',
        itemToRelate: false
    }, {
        multipleToRelate: false,
        relationshipKey: 'related_graduate_studies',
        relateToContentType: 'graduatestudies',
        relateToContentTypeDataUsingKey: 'name',
        itemToRelate: false
    }];
};

News.prototype.dataForRelationshipsToResolve = function (currentWHData) {
    var self = this;

    var toResolve = self.relationshipsToResolve();

    if ('tags' in currentWHData) {
        // what are the tags? how do they get resolved?
    }

    return toResolve;
};
