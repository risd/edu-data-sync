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
    // return row.ektron_id;
};
OurRISD.prototype.keyFromSource = function (row) {
    // return row.ContentID;
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

                    if (res.total_posts > offsetQueryOpts.offset) {
                        offsetQueryOpts.offset += offsetQueryOpts.limit;
                        var newOffsetQueryOpts = {
                            limit: offsetQueryOpts.limit,
                            offset: offsetQueryOpts.offset +
                                    offsetQueryOpts.limit
                        };
                        offsetStream.push(newOffsetQueryOpts);
                    }
                    else {
                        offsetStream.push(null);
                    }
                }

                next();
            });

        }
    }

    function Formatter () {
        return through.obj(frmtr);

        function frmtr (post, enc, next) {
            var formatted = {};
            this.push(formatted);
            next();
        }
    }
};

OurRISD.prototype.sourceStreamToFirebaseSource = function () {
    // TODO: implement?
};

OurRISD.prototype.updateWebhookValueWithSourceValue = function (wh, src) {
    // TODO: implement
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
