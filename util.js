var through = require('through2');

// module.exports.counter = counter;
// module.exports.counterReport = counterReport;
// module.exports.loggify = loggify;
// module.exports.stringify = stringify;
// module.exports.pull = pull;


function counter (count) {
    if (!arguments.length) count = 0;

    return through.obj(write, end);

    function write (row, enc, next) {
        count += 1;
        console.log(count);
        next();
    }

    function end () {
        this.push(count);
    }
}

function loggify () {
    return through.obj(write, end);

    function write (row, enc, next) {
        console.log(row);
        this.push(row);
        next();
    }

    function end () { this.push(null); }
}

function stringify () {
    return through.obj(write);

    function write (row, enc, next) {
        this.push(JSON.stringify(row) + '\n');
        next();
    }
}

/* pushes a string to be logged. */
function counterReport (report) {
    if (!arguments.length) report = function (x) { return x; };

    var count = 0;
    return through.obj(write, end);

    function write (row, enc, next) {
        count += 1;
        next();
    }

    function end () {
        this.push(report(count));
        this.push(null);
    }
}

function pull () {
    return through.obj(
                function (row, enc, next) {
                    this.push(row);
                    next();
                },
                function end () {
                    this.push(null);
                });
}
