var through = require('through2');

// module.exports.counter = counter;
// module.exports.counterReport = counterReport;
// module.exports.loggify = loggify;
// module.exports.stringify = stringify;
// module.exports.pull = pull;
module.exports.webhookDepartmentForColleagueDepartment =
    webhookDepartmentForColleagueDepartment;


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

function webhookDepartmentForColleagueDepartment (colleagueDepartment) {
    var departments = [{
            "colleague": "Textiles",
            "webhook": "Textiles"
        }, {
            "colleague": "Painting Dept",
            "webhook": "Painting"
        }, {
            "colleague": "Glass Dept",
            "webhook": "Glass"
        }, {
            "colleague": "Sculpture Dept",
            "webhook": "Sculpture"
        }, {
            "colleague": "Printmaking Dept",
            "webhook": "Printmaking"
        }, {
            "colleague": "Photography Dept",
            "webhook": "Photography"
        }, {
            "colleague": "LA Hist Art &amp; Vis",
            "webhook": "History of Art + Visual Culture"
        }, {
            "colleague": "LA English",
            "webhook": "Literary Arts + Studies"
        }, {
            "colleague": "LA His/Phil/Soc",
            "webhook": "History, Philosophy + The Social Sciences"
        }, {
            "colleague": "Digital Media Dept",
            "webhook": "Digital + Media"
        }, {
            "colleague": "Teach Learn Art+",
            "webhook": "Teaching + Learning in Art + Design"
        }, {
            "colleague": "Landscape Arch",
            "webhook": "Landscape Architecture"
        }, {
            "colleague": "Jewelry &amp; Metalsmith",
            "webhook": "Jewelry + Metalsmithing"
        }, {
            "colleague": "Interior Arch",
            "webhook": "Interior Architecture"
        }, {
            "colleague": "Industrial Design",
            "webhook": "Industrial Design"
        }, {
            "colleague": "Illustration",
            "webhook": "Illustration"
        }, {
            "colleague": "Furniture Design",
            "webhook": "Furniture Design"
        }, {
            "colleague": "Foundation Studies",
            "webhook": "Foundation Studies"
        }, {
            "colleague": "Film/Anim/Video",
            "webhook": "Film / Animation / Video"
        }, {
            "colleague": "Ceramics Dept",
            "webhook": "Ceramics"
        }, {
            "colleague": "Architecture",
            "webhook": "Architecture"
        }, {
            "colleague": "Graphic Design",
            "webhook": "Graphic Design"
        }, {
            "colleague": "Apparel Design",
            "webhook": "Apparel Design"
        }];

    var f = departments
        .filter(function (d) {
            return d.colleague === colleagueDepartment;
        })
        .map(function (d) {
            return d.webhook;
        });

    if (f.length !== 1) {
        var m = [
            'Could not find webhook name for ',
            'colleague department: ',
            colleagueDepartment
        ];
        throw new Error(m.join(''));
    }
    
    var webhookDepartment = f[0].webhook;

    return webhookDepartment;
}