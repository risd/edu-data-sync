var whUtil = require('./whUtil.js')();

module.exports = AbstractSource;

function AbstractSource () {
    if (!(this instanceof AbstractSource)) return new AbstractSource();
    var self = this;
}

AbstractSource.prototype.webhookContentType = '';
AbstractSource.prototype.webhookKeyName = '';
AbstractSource.prototype.keyFromWebhook = function (row) {
    return row.id;
};
AbstractSource.prototype.keyFromSource = function (row) {
    return row.id;
};

AbstractSource.prototype.listSource = function () {
    var self = this;

    var eventStream = through.obj();

    return eventStream;
};

AbstractSource.prototype.updateWebhookValueWithSourceValue = function (wh, src) {
    
    return (whUtil.whRequiredDates(wh));
};
