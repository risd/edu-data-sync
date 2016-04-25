var debug = require('debug')('trigger-build');
var Env = require('./env.js')();

module.exports = APIBuild;
module.exports.stream = APIBuildStream;

function APIBuild (cb) {
  var request = require('request');

  var url = [
      "https://server.webhook.com/build/",
      "?site=", process.env.FB_SITENAME,
      "&apiKey=", process.env.WH_APIKEY,
    ].join('');

  request.post(url, cb);  
}

function APIBuildStream () {

  return require('through2').obj(apiTrigger);

  function apiTrigger (source, enc, next) {

    APIBuild(end);

    function end (err, res, body) {
      var stepError = new Error(
        'Could not trigger build.');
      if (err) {
        source.errors
          .push(stepError);

        if (err instanceof Error) {
          source.errors.push(err);
        }
      }
      next(null, source);
    }
  }

}
