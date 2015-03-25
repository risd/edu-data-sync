var fs = require('fs');
var xmlStream = require('xml-stream');
var through = require('through2');
var whUtil = require('../whUtil.js')();

var departmentMaps = require('../departments.json');

/*

updateExisting
    for those already in webhook,
    with a datatel id, make them whole

addNew
    any people NOT already in webhook,
    make them whole

remove
    for datatel IDs that are no longer
    in employees.xml
    simply not including them in whExport
    will remove them from the dataset

*/

module.exports = function datatelEmployees () {
    return through.obj(dttl);

    function dttl (whExport, enc, next) {
        console.log('addEmployees:start');
        var self = this;
        // operating on row.data.people

        var s =
            employeeStream()
                .pipe(updateExisting(whExport))
                .pipe(createNotExisting(whExport))
                .pipe(addRelatedDepartment(whExport));

        s.on('data', function (d) { });
        s.on('end', function () {
            console.log('addEmployees:end');
            self.push(whExport);
            next();
        });
    }
};

function employeeStream (filePath) {
    var t = through.obj();
    var defaultPath = './data/employees/employees.xml';
    if (!(filePath)) {
        filePath = defaultPath;
    }

    var e;
    try {
        e = fs.createReadStream(filePath);
    } catch (err) {
        var m = [
            'Could not read employee.xml.',
            '\n',
            'Expected file: ' + filePath
        ];

        console.log(m);
        t.push(null);
        return t;
    }

    var xml = new xmlStream(
        fs.createReadStream(
            './data/employees/employees.xml'));

    xml.on('endElement: row', function (d) {
        t.push(d);
    });

    xml.on('end', function () {
        t.push(null);
    });

    return t;
}

function updateExisting (whExport) {
    /*
    Expecting all of the employees from the
    datatel stream to come through here.
    Each row is a datatelEmployee.

    Pushes an updatedResult object that
    For those that are already in the system,
    based on their datatel id's, extend their
    wh data representation with datatel data.
    For those who are NOT already in the system
    based on that UID, push them through to
    the next step in the pipeline.
    */
    return through.obj(update);

    function update (datatelEmployee, enc, next) {
        var people = Object.keys(
            whExport.data.people);
        
        var current;

        for (var i = people.length - 1; i >= 0; i--) {
            var p = whExport.data.people[people[i]];
            if ((+p.datatel_id) ===
                (+datatelEmployee.UID)) {

                // console.log("found match!");
                current = i;
                break;
            }
        }

        var row = {
            datatelEmployee: datatelEmployee
        };
        if (current) {
            extendWHPersonWithDatatel(
                whExport.data.people[people[current]],
                datatelEmployee);

            row.whPerson = whExport.data.people[people[current]];
            row.updated = true;
            
        } else {
            row.updated = false;
        }

        this.push(row);
        next();
    }
}

function createNotExisting (whExport) {
    var createWHPersonWithDatatelEmployee =
        createWHPersonFactoryWithControls(
            whExport
                .contentType
                .people
                .controls);
    /*
    Expecting datatelEmployee entries that
    need to be turned into a whPerson instance
    for import into WH.
    */

    return through.obj(create);

    function create (row, enc, next) {
        if (row.updated === false) {
            row.created = true;

            var whPersonKV =
                createWHPersonWithDatatelEmployee(
                    row.datatelEmployee);

            extendWHPersonWithDatatel(
                whPersonKV.value,
                row.datatelEmployee);

            whExport.data.people[whPersonKV.key] =
                whPersonKV.value;

            row.whPerson = whExport.data.people[whPersonKV.key];
        } else {
            row.created = false;
        }

        this.push(row);
        next();
    }
}

function addRelatedDepartment (whExport) {
    /*
    Adds the related department. Only
    one department is supported in the
    XML, so we can only have one here.
    */
    var whDepartments = Object.keys(
        whExport.data.departments);

    return through.obj(department);

    function department (row, enc, next) {
        var found = false;
        // Loop through department map
        // to find the webhook and datatel
        // versions of the department names
        for (var i = departmentMaps.length - 1; i >= 0; i--) {
            // { webhook: '', datatel: '' }
            var dept = departmentMaps[i];
            if (dept.datatel === row.datatelEmployee.DEPARTMENT) {
                if (!('department' in row.whPerson)) {
                    row.whPerson.department = [];
                }
                if (!(Array.isArray(row.whPerson.department))) {
                    row.whPerson.department = [];
                }

                var relatedDepartment = ['departments'];
                whDepartments.forEach(function (did) {

                    if (whExport
                            .data
                            .departments[did]
                            .name ===
                        dept.webhook) {

                        relatedDepartment.push(did);
                    }

                });

                row.whPerson
                    .department
                    .push(relatedDepartment.join(' '));

                found = true;
                break;
            }
        }

        row.relatedDepartment = found;
        this.push(row);
        next();
    }
}

function extendWHPersonWithDatatel (whPerson, datatelEmployee) {
    whPerson.datatel_id = (+datatelEmployee.UID);

    if (datatelEmployee.EMAIL.length > 0) {
        whPerson.email = datatelEmployee.EMAIL;
    }

    if (datatelEmployee.PHONE.length > 0) {
        whPerson.phone_number = datatelEmployee.PHONE;
    }

    if (datatelEmployee.TITLE.length > 0) {
        whPerson.title = datatelEmployee.TITLE;
    }

    whPerson.person = {
        first: firstName(datatelEmployee),
        last: datatelEmployee.LASTNAME
    };
}

function createWHPersonFactoryWithControls (controls) {
    /*
    Controls is the metadata for a webhook type.
    whExport.contentType.<nameofcontenttype>.controls
    Using these controls, define defaults for the
    elements that require them. Including radio
    buttons and checkbox's. Most everything else
    has no default values required to render it.
    */

    // Stash default values based on the
    // controls schema in baseWHPerson
    var baseWHPerson = {};

    // Extend baseWHPerson with defaults
    controls.forEach(function (control) {
        if (control.controlType === 'radio') {
            baseWHPerson[control.name] =
                control.meta.defaultValue;
        }
        else if (control.controlType === 'checkbox') {
            baseWHPerson[control.name] =
                control.meta.options.map(function (option) {
                    return {
                        "label": option.label,
                        "value": option.defaultValue
                    };
                });
        }
    });

    return createWHPersonWithDatatelEmployee;

    function createWHPersonWithDatatelEmployee (datatelEmployee) {
        /*
        Expect a datatelEmployee as an argument, use
        it to extend baseWHPerson into an instance
        of whPerson;
        */
        var time = new Date();
        var key = whUtil.getKey();

        var whPerson = {};
        for (var k in baseWHPerson) {
            whPerson[k] = baseWHPerson[k];
        }

        whPerson.create_date = whUtil.formattedDate(time);
        whPerson.publish_date = whUtil.formattedDate(time);
        whPerson.last_updated = whUtil.formattedDate(time);
        whPerson._sort_create_date = time.getTime();
        whPerson._sort_last_updated = time.getTime();
        whPerson.name = firstName(datatelEmployee) +
                        ' ' +
                        datatelEmployee.LASTNAME;
        whPerson.preview_url = whUtil.guid();

        return {
            key: key,
            value: whPerson
        };
    }
}

function firstName (datatelEmployee) {
    // Default first name.
    var first = datatelEmployee.FIRSTNAME;
    var alternatives = [];

    // nickname > firstname
    if (datatelEmployee.NICKNAME.length > 0) {
        alternatives.push('NICKNAME');
    }
    // derivedname > nickname
    if (datatelEmployee.DERIVEDNAME.length > 0) {
        alternatives.push('DERIVEDNAME');
    }

    if (alternatives.length > 0) {
        var alternative = alternatives.pop();
        first = datatelEmployee[alternative];
    }

    return first;
}