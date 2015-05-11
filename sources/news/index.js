var fs = require('fs');
var cheerio = require('cheerio');
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

// Used for migration
News.prototype.feedImageUrls = function () {
    var self = this;

    return through.obj(imgurl);

    function imgurl (news, enc, next) {
        this.push({
            id: self.keyFromSource(news),
            type: 'featured_image',
            ektron: prepend(news.featured_image),
            wh: false
        });
        this.push({
            id: self.keyFromSource(news),
            type: 'thumbnail_image',
            ektron: prepend(news.thumbnail_image),
            wh: false
        });
        next();

        function prepend (url) {
            if (url.indexOf('risd.edu') === -1) {
                url = 'http://risd.edu' + url;
            }
            return url;
        }
    }
};

News.prototype.listSource = function () {
    console.log('News.listSource');
    var self = this;

    var eventStream = through.obj();

    var xmlFilePaths =
        ['/news2010.xml',
         '/news2014.xml'];

    var valueForThumbimage = HTMLValueForTag('thumbimage');
    var valueForBody = HTMLValueForTag('body');
    var valueForCaption = HTMLValueForTag('caption');
    var valueForImage = HTMLValueForTag('image');

    var sources = xmlFilePaths.map(function (name){
            return new xmlStream(
                fs.createReadStream(
                    __dirname + name ));
        });

    var sourcesCount = sources.length;

    sources.forEach(function (source) {
        source.on('endElement: NewsItem', function (d) {
            d.caption = valueForCaption(d.HMTL);
            d.thumbnail_image = valueForThumbimage(d.HMTL);
            d.body = [d.HMTL]
                .map(valueForBody)
                .map(replaceBrWithP)
                .map(ensureWrapInP)
                .map(addPOnRelated)
                .map(removeEmptyP)
                .map(removeRelated)
                [0];
            d.featured_image = valueForImage(d.HMTL);
            d.tags = [d.TaxonomyName];
            eventStream.push(d);
        });

        source.on('end', function () {
            sourcesCount -=1;
            if (sourcesCount === 0) {
                console.log('News.listSource::end');
                eventStream.push(null);
            }
        });
    });

    return eventStream;

    function HTMLValueForTag (tag) {
        return function (html) {
            var value = '';
            var splitStart = html.split('<' + tag + '>');
            if (splitStart.length > 1) {
                var splitEnd = splitStart[1].split('</' + tag + '>');
                value = splitEnd[0];
            }
            return value;
        };
    }

    function ensureWrapInP (body) {
        if (!(body.indexOf('<p>') === 0)) {
            body = '<p>' + body;
        }
        if (!(body.indexOf('</p>') === (body.length - 5))) {
            body = body + '</p>';   
        }
        return body;
    }

    function replaceBrWithP (body) {
        return body.replace(/<br \/>/g, '</p><p>');
    }

    function addPOnRelated (body) {
        // for cases where this happens
        // </p> <em>related links:</em><br />
        return body.replace(/<\/p> <em>/g, '</p><p><em>');
    }

    function removeEmptyP (body) {
        var $ = cheerio.load('<div>' + body + '</div>');
        return $('p')
            .map(function (i, el) {
                if ($(this).text().trim().length > 0) {
                    return $(this);
                }
            })
            .get()
            .join(' ');
    }

    function removeRelated (body) {
        var $ = cheerio.load('<div>' + body + '</div>');
        
        // everything after finding related
        // gets filtered
        var foundRelated = false;

        return $('p')
            .map(function (i, el) {

                var html = $(this).html().toLowerCase();
                // luckily the related links section
                // is consistently. The first word
                // in the p tag is "related"
                // which is always preceeded by some
                // element being closed. 
                if (html.indexOf('>related') > -1) {
                    foundRelated = true;
                }
                if (html.indexOf('>links') > -1) {
                    foundRelated = true;
                }

                if (foundRelated === false) {
                    return $(this);
                }
            })
            .get()
            .join(' ');
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
    wh.name = toTitleCase(src.Title);
    wh.ektron_id = this.keyFromSource(src);
    wh.body = formatBody(src.body);
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

    function toTitleCase(str) {
        return str.replace(
            /\w\S*/g,
            function (txt) {
                return txt
                        .charAt(0)
                        .toUpperCase() +
                    txt.substr(1)
                       .toLowerCase();
        });
    }

    function formatBody (body) {
        body = body.replace(/<br \/>/g, '</p><p>')
                   .replace(/<br\/>/g, '</p><p>');

        var $ = cheerio.load('<div>' + body + '</div>');

        // remove empty p tags
        $('p').each(function () {
            if ($(this).text().trim() === 0) {
                $(this).remove();
            }
        });

        return $.html();
    }
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
        // relateToContentTypeDataUsingKey: 'name',
        itemToRelate: false
    }, {
        multipleToRelate: false,
        relationshipKey: 'related_graduate_studies',
        relateToContentType: 'graduatestudies',
        // relateToContentTypeDataUsingKey: 'name',
        itemToRelate: false
    }, {
        multipleToRelate: true,
        relationshipKey: 'related_liberal_arts_departments',
        relateToContentType: 'liberalartsdepartments',
        relateToContentTypeDataUsingKey: 'name',
        itemsToRelate: []
    }];
};

News.prototype.dataForRelationshipsToResolve = function (currentWHData) {
    var self = this;

    var toResolve = self.relationshipsToResolve();

    if ('tags' in currentWHData) {
        // what are the tags? how do they get resolved?
        // is this just a series of relationships?
        // related_departments
        // related_froundation_studies
        // related_graduate_studies
        // 
        // where do we want things to end up?
        // tags are our organizational system. they should
        // relate to a content type?
    }

    return toResolve;
};
