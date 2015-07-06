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

// Migration protocol
News.prototype.feedImageUrls = function () {
    var self = this;

    return through.obj(imgurl);

    function imgurl (row, enc, next) {
        // expects
        // row.{whKey, webhook}
        // 
        // pushes
        // {whKey, type, ektron, wh}

        if (('featured_image' in row.webhook) &&
            (typeof row.webhook.featured_image === 'string')) {
            this.push({
                whKey: row.whKey,
                type: 'featured_image',
                ektron: prepend(row.webhook.featured_image),
                wh: false
            });
        }
        
        if (('thumbnail_image' in row.webhook) &&
            (typeof row.webhook.thumbnail_image === 'string')) {
            this.push({
                whKey: row.whKey,
                type: 'thumbnail_image',
                ektron: prepend(row.webhook.thumbnail_image),
                wh: false
            });
        }

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
        ['/news2014.xml'];

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
            if (d.HMTL.length > 0) {
                d.body = [d.HMTL]
                    .map(valueForBody)
                    .map(replaceBrWithP)
                    .map(ensureWrapInP)
                    .map(addPOnRelated)
                    .map(removeEmptyP)
                    .map(removeRelated)
                    [0];
                d.caption = [d.HMTL]
                    .map(valueForCaption)
                    .map(ensureWrapInP)
                    [0];
                if (d.caption.length === 0) {
                    d.caption = [d.body]
                        .map(textOf)
                        .map(ensureWrapInP)
                        [0];
                }
                d.thumbnail_image = valueForThumbimage(d.HMTL);
                d.featured_image = valueForImage(d.HMTL);
                d.tags = [d.TaxonomyName];

                eventStream.push(d);
            }
        });

        source.on('end', function () {
            sourcesCount -= 1;
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
        if (body.length === 0) {
            return body;
        }
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

    function textOf (body) {
        var $ = cheerio.load('<div class="top">' + body + '</div>');
        var text = $('p').first().text().split('.')[0];
        if (text.toLowerCase()
                .indexOf('brightcove') > -1) {
            text = '';
            $('.top')
                .children()
                .each(function (i, el) {
                    if ($(el).text()
                            .toLowerCase()
                            .indexOf('brightcove') === -1) {

                        if (text.length === 0) {
                            text = $(el)
                                .text()
                                .trim()
                                .split('.')[0];
                        }

                    }
                });
        }
        if (text) {
            text += '.';
        }
        return text;
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
    var title = src.Title;
    if (title) {
        wh.name = title;
    }
    wh.story_type = 'News';

    // Comment me out if you aren't uploading images.
    // if (src.featured_image) {
    //     wh.featured_image = src.featured_image;
    // }

    // if (src.thumbnail_image) {
    //     wh.thumbnail_image = src.thumbnail_image;
    // }
    // End: comment me out if you aren't uploading images.

    wh.story = src.body;

    if (src.caption) {
        wh.intro = src.caption;
    }

    var ektron_id = this.keyFromSource(src);
    if (ektron_id) {
        wh.ektron_id = ektron_id;
    }
    wh.ektron_taxonomy = src.tags
        .map(function (d) {
            return { tag: d };
        });

    wh.isDraft = false;

    // These carry dates that we want to maintain
    wh.create_date = moment(src.CreatedDate).format();
    wh.publish_date = moment(src.EditDate).format();
    wh.last_updated = moment(src.EditDate).format();
    wh._sort_create_date = moment(src.CreatedDate).unix();
    wh._sort_last_updated = moment(src.EditDate).unix();
    wh._sort_publish_date = moment(src.EditDate).unix();
    wh.preview_url = whUtil.guid();

    console.log('updateWebhookValueWithSourceValue');
    console.log(wh);

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
    }, {
        multipleToRelate: true,
        relationshipKey: 'related_initiative',
        relateToContentType: 'initiatives',
        relateToContentTypeDataUsingKey: 'name',
        itemsToRelate: []
    }];
};

News.prototype.dataForRelationshipsToResolve = function (currentWHData) {
    var self = this;

    var toResolve = self.relationshipsToResolve();

    if ('ektron_taxonomy' in currentWHData) {
        var departments =
            currentWHData.ektron_taxonomy
                .map(function (d) { return d.tag; })
                .map(whUtil.webhookDepartmentForEktronNews)
                .filter(function (d) { return d !== false; })
                .map(function (d) {
                    return { departments: d };
                });

        toResolve[0].itemsToRelate = departments;

        
        var foundation =
            currentWHData.ektron_taxonomy
                .filter(function (d) {
                    return d.tag === 'Foundation Studies';
                });

        if (foundation.length === 1) {
            toResolve[1].itemToRelate = true;
        }

        var graduate =
            currentWHData.ektron_taxonomy
                .filter(function (d) {
                    return d.tag === 'graduate';
                });

        if (graduate.length === 1) {
            toResolve[2].itemToRelate = true;
        }


        var liberalArtsDepartments =
            currentWHData.ektron_taxonomy
                .map(function (d) { return d.tag; })
                .map(whUtil.webhookLiberalArtsDepartmentForEktronNews)
                .filter(function (d) { return d !== false; })
                .map(function (d) {
                    return { liberalartsdepartments: d };
                });

        toResolve[3].itemsToRelate = liberalArtsDepartments;


        var initiatives =
            currentWHData.ektron_taxonomy
                .map(function (d) { return d.tag; })
                .map(whUtil.webhookInitiativeForEktronNews)
                .filter(function (d) { return d !== false; })
                .map(function (d) {
                    return { initiatives: d };
                });

        toResolve[4].itemsToRelate = initiatives;
    }

    return toResolve;
};
