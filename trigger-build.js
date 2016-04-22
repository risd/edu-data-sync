var Env = require('./env.js')();
var through = require('through2');
var request = require('request');

module.exports = TriggerBuild;

function TriggerBuild () {

  return through.obj(apiTrigger);

  function apiTrigger (source, enc, next) {
    var url = [
      "https://server.webhook.com/build/",
      "?site=", process.env.FB_SITENAME,
      "&apiKey=", process.env.WH_APIKEY,
      ].join('');

    request.post(url, end);

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

  /* not currently being used.
     this is the node that gets updated in
     firebase that triggers a build signal. */
  function firebaseTrigger (fb, enc, next) {
    var data = {
      userid: process.env.WH_EMAIL,
      sitename: process.env.FB_SITENAME,
      id: uniqueId(),
      build_time: moment().format()
    };

    // This is the node that signals a new build 
    // to occur.
    var child = 'management/commands/build/' + process.env.FB_SITENAME;

    fb.root()
      .child(child)
      .set('value', function (err) {
        console.log(err);
        next(null);
      });
  }
}


