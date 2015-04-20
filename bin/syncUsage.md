```
sync
    events
    courses
    employees
    news
    -h
    help

`no args`  Passing no arguments will run the sync
           with all of the sources included.

events     A source. Based on the Localist API.

courses    A source. Based on an XML dump
           from Colleague.

employees  A source. Based on an XML dump
           from Colleague.

news       A source. Based on an XML dump
           from Ektron. This is meant to be
           used during the transition from
           Ektron to WebHook. Then news will
           be handled within the WebHook CMS.

help       Print this.
```