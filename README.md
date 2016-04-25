# edu-data-sync

Application that runs on Heroku, using Heroku scheduler.

Piggy back's a the webhook firebase instance. Where `data`, `contentType` & `presence` are typically the top level nodes for data, this application adds a third. `eduSync`. In here, data from different APIs is stashed, and diffed against current objects in the live `data` tree of the Firebase.

A [report](http://edu-data-sync-report.s3-website-us-east-1.amazonaws.com/index.html) is written at the end of the process.

### Locally

Relies on having run `wh init` to get the `.firebase.conf` file, as well as a `.risdmedia.conf` file that houses credentials for accessing the firebase via a WebHook account.

To run locally.

`./bin/sync`


### Heroku

Relies on having configuration variables set on Heroku. This can be done by running `./bin/heroku-config`.

To run on Heroku.

`heroku run sync --app edu-data-sync`
