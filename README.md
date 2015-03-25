# edu-data-sync

Application that runs on Heroku, using heroku scheduler.

Piggy back's a the webhook firebase instance. Where `data` and `contentTypes` are typically the top level buckets for data, this application adds a third. `sync`. In here, API data is stashed, and diffed against current objects in the live `data` tree of the firebase.


### Locally

Relies on having run `wh init` to get the `.firebase.conf` file, as well as a `.risdmedia.conf` file that houses credentials for accessing the firebase via a WebHook account.


### Heroku

Before Heroku can run this, variables need to be configured. You can do that by running `./bin/herokuConfig`

`heroku config:set WH_EMAIL=`
`heroku config:set WH_PASSWORD=`
`heroku config:set WH_FIREBASE=`