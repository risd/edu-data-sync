# edu-data-sync

Application that runs on Heroku, using Heroku scheduler.

Piggy back's a the webhook firebase instance. Where `data`, `contentType` & `presence` are typically the top level nodes for data, this application adds a third. `eduSync`. In here, data from different APIs is stashed, and diffed against current objects in the live `data` tree of the Firebase.


### Environment variables

Requires the environment variables contained within [`.env.example`]('./.env.exmaple'). 

Uses [dotenv-safe](https://github.com/rolodato/dotenv-safe) via [env.js](env.js) to load configuration.


### Heroku

Relies on having configuration variables set on Heroku. This can be done by running `./bin/heroku-config`.

To run on Heroku.

`heroku run sync --app edu-data-sync`
