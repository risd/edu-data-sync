var fs = require('fs');
var cheerio = require('cheerio');
var through = require('through2');
var moment = require('moment');
var tumblr = require('tumblr.js');

var whUtil = require('../whUtil.js')();

module.exports = OurRISD;

/**
 * News are provided via XML dump from Ektron.
 * This will only need to be done in order to
 * suppor the transition from Ektron to WebHook.
 */
function OurRISD () {
    if (!(this instanceof OurRISD)) return new OurRISD();
}

OurRISD.prototype.webhookContentType = 'news';
OurRISD.prototype.keyFromWebhook = function (row) {
    return row.tumblr_id;
};
OurRISD.prototype.keyFromSource = function (row) {
    return row.id;
};

// Migration protocol
OurRISD.prototype.feedImageUrls = function () {
    var self = this;

    return through.obj(imgurl);

    function imgurl (row, enc, next) {
        // expects
        // row.{whKey, webhook}
        // 
        // pushes
        // {whKey, type, external, wh}
        
        if(('featured_image' in row.wehbook) &&
           (typeof row.webhook.featured_image === 'string')) {

            this.push({
                whKey: row.whKey,
                type: 'featured_image',
                external: row.webhook.featured_image,
                wh: false
            }); 
        }

        if (('thumbnail_image' in row.webhook) &&
            (typeof row.webhook.thumbnail_image === 'string')) {

            this.push({
                whKey: row.whKey,
                type: 'thumbnail_image',
                external: row.webhook.thumbnail_image,
                wh: false
            });
        }

        if (('body' in row.webhook) &&
            (typeof row.webhook.body === 'string')) {
            this.push({
                whKey: row.whKey,
                type: 'body',
                external: row.webhook.body,
                wh: false
            });
        }

        next();
    }
};

OurRISD.prototype.listSource = function () {
    console.log('OurRISD.listSource');
    var self = this;

    // Posts for tumblr
    var postStream = through.obj();

    // Paginated requests stream
    var offsetStream = through.obj();

    var credentials = {
        consumer_key: process.env.TUMBLR_CONSUMER_KEY,
        consumer_secret: process.env.TUMBLR_CONSUMER_SECRET
    };
    var client = tumblr.createClient(credentials);

    offsetStream.on('end', function () {
        console.log('OurRISD.listSource::end');
        postStream.push(null);
    });

    offsetStream.pipe(RecursiveOffset(client));

    var options = {
        limit: 20,
        offset: 0
    };

    offsetStream.push(options);

    return postStream.pipe(Formatter());

    function RecursiveOffset (client) {
        return through.obj(pg);

        function pg (offsetQueryOpts, enc, next) {

            client.posts('our.risd.edu', offsetQueryOpts, function (err, res) {
                if (err) {
                    console.log(err);
                    offsetStream.push(null);
                }
                else {

                    res.posts.forEach(function (p) {
                        postStream.push(p);
                    });

                    postStream.push(null);

                    // if (res.total_posts > offsetQueryOpts.offset) {
                    //     offsetQueryOpts.offset += offsetQueryOpts.limit;
                    //     var newOffsetQueryOpts = {
                    //         limit: offsetQueryOpts.limit,
                    //         offset: offsetQueryOpts.offset +
                    //                 offsetQueryOpts.limit
                    //     };
                    //     offsetStream.push(newOffsetQueryOpts);
                    // }
                    // else {
                    //     offsetStream.push(null);
                    // }
                }

                next();
            });

        }
    }

    function Formatter () {
        return through.obj(frmtr);

        function frmtr (post, enc, next) {
            var formatted = 
                [{
                    tags: post.tags,
                    id: post.id
                }]
                .map(addWHDates(post.date))
                [0];

            if (post.type === 'text') {
                var $ = cheerio.load(
                    '<div>' +
                    post.body +
                    '</div>');

                formatted.featured_image =
                    $('figure img')
                        .first()
                        .attr('src');

                formatted.thumbnail_image =
                    formatted.featured_image;

                $('figure').first().remove();

                // WebHook WYSIWYG has a
                // data-type=image on its
                // inline images.
                $('figure img')
                    .each(function (i, el) {
                        $(this)
                            .parent()
                            .attr('data-type', 'image')
                            .attr('data-orig-width', null)
                            .attr('data-orig-height', null)
                            .attr('class', null)
                            .append('<figcaption></figcaption>');
                    });
                
                formatted.body = $('div').html();

                formatted.intro =
                    $('p')
                        .first()
                        .text()
                        .split('.')
                         [0] + '.';

                formatted.name = post.title;

            }
            else if (post.type === 'photo') {

                var $body = cheerio.load('<div id="capture"></div>');

                post.photos.forEach(function (d, i) {
                    if (i === 0) {
                        formatted.featured_image = d.original_size.url;
                        formatted.thumbnail_image = formatted.featured_image;
                    }
                    else {
                        var img = [
                            '<figure ',
                                'data-type="image"',
                            '>',
                                '<img',
                                    'src="' + d.original_size.url + '"',
                                '/>',
                                '<figcaption>',
                                    (d.caption ? d.caption : ''),
                                '</figcaption>',
                            '</figure>',
                        ];

                        $body('#capture').append(img.join(' '));
                    }
                });

                formatted.body = $body('#capture').html();

                formatted.name = [post.caption]
                    .map(firstSentence)
                    .map(firstNWords(6))
                    [0];

                formatted.intro = firstSentence(post.caption);
            }
            else if (post.type === 'audio') {}
            else if (post.type === 'video') {

                formatted.featured_image = post.thumbnail_url;
                formatted.thumbnail_image = post.thumbnail_url;

                formatted.body = post.player
                    .sort(function (a, b) {
                        return a.width - b.width;
                    })
                    .filter(function (d, i, arr) {
                        return i === (arr.length - 1);
                    })
                    .map(function (d) {
                        return d.embed_code;
                    })
                    [0];

                formatted.name = [post.caption]
                    .map(firstSentence)
                    .map(firstNWords(6))
                    [0];

                formatted.intro = firstSentence(post.caption);
            }
            else if (post.type === 'link') {}

            if ('body' in formatted) {
                this.push(formatted);
            }
            next();

            function addWHDates (date) {
                var moment = require('moment');

                return function (p) {
                    var f = moment(date).format();
                    
                    p.create_date  = f;
                    p.publish_date = f;
                    p.last_updated = f;

                    var u = moment(date).unix();

                    p._sort_create_date  = u;
                    p._sort_last_updated = u;
                    p._sort_publish_date = u;

                    p.preview_url = whUtil.guid();

                    return p;
                };
            }

            function firstSentence (html) {
                var $ = cheerio.load(
                    '<div id="capture">' +
                    html +
                    '</div>');

                return $('p')
                    .first()
                    .text()
                    .split('.')[0];
            }

            function firstNWords (n) {
                return function (str) {
                    return str.split(' ')
                        .filter(function (d, i) {
                            return i < (n-1);
                        })
                        .join(' ');
                };
            }
        }
    }
};

//// No reorganization of data to do, so we can
//// just have this go straight into firebase without
//// an additional transform
// OurRISD.prototype.sourceStreamToFirebaseSource = function () { };

OurRISD.prototype.updateWebhookValueWithSourceValue = function (wh, src) {
    wh.story_type = 'News';

    if (src.name) {
        wh.name = src.name;
    }
    if (src.featured_image) {
        wh.featured_image = src.featured_image;
    }
    if (src.thumbnail_image) {
        wh.thumbnail_image = src.thumbnail_image;
    }
    if (src.intro) {
        wh.intro = src.intro;
    }
    if (src.body) {
        wh.body = src.body;
    }
    if (this.keyFromSource(src)) {
        wh.tumblr_id = this.keyFromSource(src);
    }
    if (src.tags) {
        wh.external_taxonomy = src.tags.map(function (d) {
            return { tag: d };
        });
    }

    wh.create_date = src.create_date;
    wh.publish_date = src.publish_date;
    wh.last_updated = src.last_updated;
    wh._sort_create_date = src._sort_create_date;
    wh._sort_last_updated = src._sort_last_updated;
    wh._sort_publish_date = src._sort_publish_date;
    wh.preview_url = src.preview_url;

    wh.isDraft = false;

    return wh;
};

OurRISD.prototype.relationshipsToResolve = function () {
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

OurRISD.prototype.dataForRelationshipsToResolve = function (currentWHData) {
    // TODO: implement
    var self = this;

    var toResolve = self.relationshipsToResolve();

    return toResolve;
};
