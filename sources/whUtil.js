var moment = require('moment');

module.exports = function () {
    var maps = {
        forLiberalArtsDepartments: [{
            "colleague": "LA Hist Art & Vis",
            "webhook": "History of Art + Visual Culture",
            "localist": "History of Art + Visual Culture",
            "courseCatalogue": "HISTORY OF ART&VISUAL CULTURE"
        }, {
            "colleague": "LA English",
            "webhook": "Literary Arts + Studies",
            "localist": "Literary Arts + Studies",
            "courseCatalogue": "LITERARY ARTS AND STUDIES"
        }, {
            "colleague": "LA His/Phil/Soc",
            "webhook": "History, Philosophy + The Social Sciences",
            "localist": "History, Philosophy + The Social Sciences",
            "courseCatalogue": "HIST/PHIL/SO SC DEPT"
        }],
        forDepartments: [{
            "colleague": "Textiles",
            "webhook": "Textiles",
            "localist": "Textiles",
            "courseCatalogue": "TEXTILES"
        }, {
            "colleague": "Painting Dept",
            "webhook": "Painting",
            "localist": "Painting",
            "courseCatalogue": "PAINTING"
        }, {
            "colleague": "Glass Dept",
            "webhook": "Glass",
            "localist": "Glass",
            "courseCatalogue": "GLASS"
        }, {
            "colleague": "Sculpture Dept",
            "webhook": "Sculpture",
            "localist": "Sculpture",
            "courseCatalogue": "SCULPTURE"
        }, {
            "colleague": "Printmaking Dept",
            "webhook": "Printmaking",
            "localist": "Printmaking",
            "courseCatalogue": "PRINTMAKING"
        }, {
            "colleague": "Photography Dept",
            "webhook": "Photography",
            "localist": "Photography",
            "courseCatalogue": "PHOTOGRAPHY"
        }, {
            "colleague": "Digital Media Dept",
            "webhook": "Digital + Media",
            "localist": "Digital + Media",
            "courseCatalogue": "DIGITAL & MEDIA"
        }, {
            "colleague": "Teach Learn Art+",
            "webhook": "Teaching + Learning in Art + Design",
            "localist": "Teaching + Learning in Art + Design",
            "courseCatalogue": "TLAD TEACHING + LEARNING"
        }, {
            "colleague": "Landscape Arch",
            "webhook": "Landscape Architecture",
            "localist": "Landscape Architecture",
            "courseCatalogue": "LANDSCAPE ARCH"
        }, {
            "colleague": "Jewelry & Metalsmith",
            "webhook": "Jewelry + Metalsmithing",
            "localist": "Jewelry + Metalsmithing",
            "courseCatalogue": "JEWELRY & METAL"
        }, {
            "colleague": "Interior Arch",
            "webhook": "Interior Architecture",
            "localist": "Interior Architecture",
            "courseCatalogue": "INTERIOR ARCH"
        }, {
            "colleague": "Industrial Design",
            "webhook": "Industrial Design",
            "localist": "Industrial Design",
            "courseCatalogue": "INDUSTRIAL DESIGN"
        }, {
            "colleague": "Illustration",
            "webhook": "Illustration",
            "localist": "Illustration",
            "courseCatalogue": "ILLUSTRATION"
        }, {
            "colleague": "Furniture Design",
            "webhook": "Furniture Design",
            "localist": "Furniture Design",
            "courseCatalogue": "FURNITURE DESIGN"
        }, {
            "colleague": "Film/Anim/Video",
            "webhook": "Film / Animation / Video",
            "localist": "Film/Animation/Video",
            "courseCatalogue": "FILM/ANIMATION/VIDEO"
        }, {
            "colleague": "Ceramics Dept",
            "webhook": "Ceramics",
            "localist": "Ceramics",
            "courseCatalogue": "CERAMICS"
        }, {
            "colleague": "Architecture",
            "webhook": "Architecture",
            "localist": "Architecture",
            "courseCatalogue": "ARCHITECTURE"
        }, {
            "colleague": "Graphic Design",
            "webhook": "Graphic Design",
            "localist": "Graphic Design",
            "courseCatalogue": "GRAPHIC DESIGN"
        }, {
            "colleague": "Apparel Design",
            "webhook": "Apparel Design",
            "localist": "Apparel Design",
            "courseCatalogue": "APPAREL DESIGN"
        }]
    };

    // var foundationstudiesMap = [{
    //         "colleague": "Foundation Studies",
    //         "webhook": "Foundation Studies",
    //         "localist": "Division of Foundation Studies",
    //         "courseCatalogue": "FOUNDATION STUDIES"
    //     }];

    return {
        guid: guid,
        getKey: getKey,
        formattedDate: formattedDate,
        whRequiredDates: whRequiredDates,
        webhookDepartmentForCourseCatalogue:
            forMapUsingKeyFindWebhookValue(
                'forDepartments',
                'courseCatalogue'),
        webhookDepartmentForLocalist:
            forMapUsingKeyFindWebhookValue(
                'forDepartments',
                'webhook'),
        webhookDepartmentForColleague:
            forMapUsingKeyFindWebhookValue(
                'forDepartments',
                'colleague'),
        webhookLiberalArtsDepartmentForCourseCatalogue:
            forMapUsingKeyFindWebhookValue(
                'forLiberalArtsDepartments',
                'courseCatalogue'),
        webhookLiberalArtsDepartmentForColleague:
            forMapUsingKeyFindWebhookValue(
                'forLiberalArtsDepartments',
                'colleague')
    };

    function forMapUsingKeyFindWebhookValue (mapName, compareKey) {
        return function withValue (compareValue) {
            var f =
                maps[mapName]
                    .filter(function (d) {
                        return d[compareKey] === compareValue;
                    })
                    .map(function (d) {
                        return d.webhook;
                    });

            if (f.length === 0) {
                // console.log('Could not find webhook name for');
                // console.log(compareValue);
                // console.log('in map: ', mapName);
                // console.log('using key: ', compareKey);
                return false;
            } else {
                var webhookDepartment = f[0];
                return webhookDepartment;
            }
        };
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