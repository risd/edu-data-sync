var through = require('through2');

module.exports.counter = counter;
module.exports.counterReport = counterReport;
module.exports.loggify = loggify;
module.exports.stringify = stringify;
module.exports.pull = pull;
module.exports.departmentMap = departmentMap;


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

function departmentMap () {
    return [{
            "datatel": "Textiles",
            "webhook": "Textiles"
        }, {
            "datatel": "Painting Dept",
            "webhook": "Painting"
        }, {
            "datatel": "Glass Dept",
            "webhook": "Glass"
        }, {
            "datatel": "Sculpture Dept",
            "webhook": "Sculpture"
        }, {
            "datatel": "Printmaking Dept",
            "webhook": "Printmaking"
        }, {
            "datatel": "Photography Dept",
            "webhook": "Photography"
        }, {
            "datatel": "LA Hist Art &amp; Vis",
            "webhook": "History of Art + Visual Culture"
        }, {
            "datatel": "LA English",
            "webhook": "Literary Arts + Studies"
        }, {
            "datatel": "LA His/Phil/Soc",
            "webhook": "History, Philosophy + The Social Sciences"
        }, {
            "datatel": "Digital Media Dept",
            "webhook": "Digital + Media"
        }, {
            "datatel": "Teach Learn Art+",
            "webhook": "Teaching + Learning in Art + Design"
        }, {
            "datatel": "Landscape Arch",
            "webhook": "Landscape Architecture"
        }, {
            "datatel": "Jewelry &amp; Metalsmith",
            "webhook": "Jewelry + Metalsmithing"
        }, {
            "datatel": "Interior Arch",
            "webhook": "Interior Architecture"
        }, {
            "datatel": "Industrial Design",
            "webhook": "Industrial Design"
        }, {
            "datatel": "Illustration",
            "webhook": "Illustration"
        }, {
            "datatel": "Furniture Design",
            "webhook": "Furniture Design"
        }, {
            "datatel": "Foundation Studies",
            "webhook": "Foundation Studies"
        }, {
            "datatel": "Film/Anim/Video",
            "webhook": "Film / Animation / Video"
        }, {
            "datatel": "Ceramics Dept",
            "webhook": "Ceramics"
        }, {
            "datatel": "Architecture",
            "webhook": "Architecture"
        }, {
            "datatel": "Graphic Design",
            "webhook": "Graphic Design"
        }, {
            "datatel": "Apparel Design",
            "webhook": "Apparel Design"
        }];
}