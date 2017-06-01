# edu-data-sync

Application that runs on Heroku, using Heroku scheduler.

Piggy back's a the webhook firebase instance. Where `data`, `contentType` & `presence` are typically the top level nodes for data, this application adds a third. `eduSync`. In here, data from different APIs is stashed, and diffed against current objects in the live `data` tree of the Firebase.

A [report](http://edu-data-sync-report.s3-website-us-east-1.amazonaws.com/index.html) is written at the end of the process.


### Environment variables

Requires the following environment variables to be defined. 

```
SITE_NAME
FIREBASE_NAME
FIREBASE_KEY
ELASTIC_SEARCH_SERVER
ELASTIC_SEARCH_USER
ELASTIC_SEARCH_PASSWORD
```

Uses [dotenv-safe](https://github.com/rolodato/dotenv-safe) via [env.js](env.js) to load configuration.


### Heroku

Relies on having configuration variables set on Heroku. This can be done by running `./bin/heroku-config`.

To run on Heroku.

`heroku run sync --app edu-data-sync`
