# edu-data-sync

Application that runs on Heroku, using Heroku scheduler.

Piggy back's a the webhook firebase instance. Where `data`, `contentType` & `presence` are typically the top level nodes for data, this application adds a third. `eduSync`. In here, API data is stashed, and diffed against current objects in the live `data` tree of the firebase.


### Locally

Relies on having run `wh init` to get the `.firebase.conf` file, as well as a `.risdmedia.conf` file that houses credentials for accessing the firebase via a WebHook account.


### Heroku

Before Heroku can run this, variables need to be configured. You can do that by running `./bin/herokuConfig`.

To run the sync on Heroku

`heroku run sync --app edu-data-sync`