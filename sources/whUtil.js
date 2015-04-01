var moment = require('moment');

module.exports = function () {
    var departmentMap = [{
            "colleague": "Textiles",
            "webhook": "Textiles",
            "courseCatalogue": "TEXTILES"
        }, {
            "colleague": "Painting Dept",
            "webhook": "Painting",
            "courseCatalogue": "PAINTING"
        }, {
            "colleague": "Glass Dept",
            "webhook": "Glass",
            "courseCatalogue": "GLASS"
        }, {
            "colleague": "Sculpture Dept",
            "webhook": "Sculpture",
            "courseCatalogue": "SCULPTURE"
        }, {
            "colleague": "Printmaking Dept",
            "webhook": "Printmaking",
            "courseCatalogue": "PRINTMAKING"
        }, {
            "colleague": "Photography Dept",
            "webhook": "Photography",
            "courseCatalogue": "PHOTOGRAPHY"
        }, {
            "colleague": "LA Hist Art &amp; Vis",
            "webhook": "History of Art + Visual Culture",
            "courseCatalogue": "HISTORY OF ART&VISUAL CULTURE"
        }, {
            "colleague": "LA English",
            "webhook": "Literary Arts + Studies",
            "courseCatalogue": "LITERARY ARTS AND STUDIES"
        }, {
            "colleague": "LA His/Phil/Soc",
            "webhook": "History, Philosophy + The Social Sciences",
            "courseCatalogue": "HIST/PHIL/SO SC DEPT"
        }, {
            "colleague": "Digital Media Dept",
            "webhook": "Digital + Media",
            "courseCatalogue": "DIGITAL & MEDIA"
        }, {
            "colleague": "Teach Learn Art+",
            "webhook": "Teaching + Learning in Art + Design",
            "courseCatalogue": "TLAD TEACHING + LEARNING"
        }, {
            "colleague": "Landscape Arch",
            "webhook": "Landscape Architecture",
            "courseCatalogue": "LANDSCAPE ARCH"
        }, {
            "colleague": "Jewelry &amp; Metalsmith",
            "webhook": "Jewelry + Metalsmithing",
            "courseCatalogue": "JEWELRY & METAL"
        }, {
            "colleague": "Interior Arch",
            "webhook": "Interior Architecture",
            "courseCatalogue": "INTERIOR ARCH"
        }, {
            "colleague": "Industrial Design",
            "webhook": "Industrial Design",
            "courseCatalogue": "INDUSTRIAL DESIGN"
        }, {
            "colleague": "Illustration",
            "webhook": "Illustration",
            "courseCatalogue": "ILLUSTRATION"
        }, {
            "colleague": "Furniture Design",
            "webhook": "Furniture Design",
            "courseCatalogue": "FURNITURE DESIGN"
        }, {
            "colleague": "Foundation Studies",
            "webhook": "Foundation Studies",
            "courseCatalogue": "FOUNDATION STUDIES"
        }, {
            "colleague": "Film/Anim/Video",
            "webhook": "Film / Animation / Video",
            "courseCatalogue": "FILM/ANIMATION/VIDEO"
        }, {
            "colleague": "Ceramics Dept",
            "webhook": "Ceramics",
            "courseCatalogue": "CERAMICS"
        }, {
            "colleague": "Architecture",
            "webhook": "Architecture",
            "courseCatalogue": "ARCHITECTURE"
        }, {
            "colleague": "Graphic Design",
            "webhook": "Graphic Design",
            "courseCatalogue": "GRAPHIC DESIGN"
        }, {
            "colleague": "Apparel Design",
            "webhook": "Apparel Design",
            "courseCatalogue": "APPAREL DESIGN"
        }];

    return {
        guid: guid,
        getKey: getKey,
        formattedDate: formattedDate,
        whRequiredDates: whRequiredDates,
        webhookDepartmentForCourseCatalogue:
            webhookDepartmentForCourseCatalogue
    };

    function webhookDepartmentForCourseCatalogue (catalogueDepartment) {

        var f = departmentMap
            .filter(function (d) {
                return d.courseCatalogue === catalogueDepartment;
            })
            .map(function (d) {
                return d.webhook;
            });

        if (f.length !== 1) {
            var m = [
                'Could not find webhook name for ',
                'colleague department: ',
                catalogueDepartment
            ];
            console.log(m.join(''));
            return false;

        } else {
            var webhookDepartment = f[0];
            return webhookDepartment;
        }
    }
};

function s4 () {
    return Math.floor((1 + Math.random()) * 0x10000)
               .toString(16)
               .substring(1);
}

function guid () {
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
           s4() + '-' + s4() + s4() + s4();
}

function getKey () {
    var keyref = firebase.push();

    var key = keyref.toString().replace(firebase.toString() + '/', '');

    return key;
}

function formattedDate(date) {
    return moment(date).format();
}

function whRequiredDates (d) {
    var time = new Date();

    d.create_date = formattedDate(time);
    d.publish_date = formattedDate(time);
    d.last_updated = formattedDate(time);
    d._sort_create_date = time.getTime();
    d._sort_last_updated = time.getTime();
    d._sort_publish_date = time.getTime();
    d.preview_url = guid();

    return d;
}