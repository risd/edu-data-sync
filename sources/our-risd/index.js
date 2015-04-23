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
    console.log('News.listSource');
    var self = this;

    var eventStream = through.obj();

    tumblrCredentials = {
        consumer_key: process.env.TUMBLR_CONSUMER_KEY,
        consumer_secret: process.env.TUMBLR_CONSUMER_SECRET
    };
    var client = tumblr.createClient(tumblrCredentials);

    client.blogInfo('our.risd.edu', function (err, res) {
        if (err) {
            console.log(err);
        }
        else {
            console.log(res);
        }
    });


    return eventStream;
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
