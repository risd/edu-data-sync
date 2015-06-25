var moment = require('moment');

module.exports = function () {
    var maps = {
        forInitiatives: [{
            "webhook": "Public Engagement",
            "ektronNews": "public engagement"
        }, {
            "webhook": "STEM to STEAM",
            "ektronNews": "STEAM"
        }],
        forLiberalArtsDepartments: [{
            "colleague": "LA Hist Art & Vis",
            "webhook": "History of Art + Visual Culture",
            "localist": "History of Art + Visual Culture",
            "courseCatalogue": "HISTORY OF ART&VISUAL CULTURE",
            "ektronNews": "History of Art + Visual Culture"
        }, {
            "colleague": "LA English",
            "webhook": "Literary Arts + Studies",
            "localist": "Literary Arts + Studies",
            "courseCatalogue": "LITERARY ARTS AND STUDIES",
            "ektronNews": "Literary Arts + Studies"
        }, {
            "colleague": "LA His/Phil/Soc",
            "webhook": "History, Philosophy + The Social Sciences",
            "localist": "History, Philosophy + the Social Sciences",
            "courseCatalogue": "HIST/PHIL/SO SC DEPT",
            "ektronNews": "History, Philosophy + the Social Sciences"
        }],
        forDepartments: [{
            "colleague": "Textiles",
            "webhook": "Textiles",
            "localist": "Textiles",
            "courseCatalogue": "TEXTILES",
            "ektronNews": "Textiles"
        }, {
            "colleague": "Painting Dept",
            "webhook": "Painting",
            "localist": "Painting",
            "courseCatalogue": "PAINTING",
            "ektronNews": "Painting"
        }, {
            "colleague": "Glass Dept",
            "webhook": "Glass",
            "localist": "Glass",
            "courseCatalogue": "GLASS",
            "ektronNews": "Glass"
        }, {
            "colleague": "Sculpture Dept",
            "webhook": "Sculpture",
            "localist": "Sculpture",
            "courseCatalogue": "SCULPTURE",
            "ektronNews": "Sculpture"
        }, {
            "colleague": "Printmaking Dept",
            "webhook": "Printmaking",
            "localist": "Printmaking",
            "courseCatalogue": "PRINTMAKING",
            "ektronNews": "Printmaking"
        }, {
            "colleague": "Photography Dept",
            "webhook": "Photography",
            "localist": "Photography",
            "courseCatalogue": "PHOTOGRAPHY",
            "ektronNews": "Photography"
        }, {
            "colleague": "Digital Media Dept",
            "webhook": "Digital + Media",
            "localist": "Digital + Media",
            "courseCatalogue": "DIGITAL & MEDIA",
            "ektronNews": "Digital + Media"
        }, {
            "colleague": "Teach Learn Art+",
            "webhook": "Teaching + Learning in Art + Design",
            "localist": "Teaching + Learning in Art + Design",
            "courseCatalogue": "TLAD TEACHING + LEARNING",
            "ektronNews": "Teaching + Learning in Art + Design"
        }, {
            "colleague": "Landscape Arch",
            "webhook": "Landscape Architecture",
            "localist": "Landscape Architecture",
            "courseCatalogue": "LANDSCAPE ARCH",
            "ektronNews": "Landscape Architecture"
        }, {
            "colleague": "Jewelry & Metalsmith",
            "webhook": "Jewelry + Metalsmithing",
            "localist": "Jewelry + Metalsmithing",
            "courseCatalogue": "JEWELRY & METAL",
            "ektronNews": "Jewelry + Metalsmithing"
        }, {
            "colleague": "Interior Arch",
            "webhook": "Interior Architecture",
            "localist": "Interior Architecture",
            "courseCatalogue": "INTERIOR ARCH",
            "ektronNews": "Interior Architecture"
        }, {
            "colleague": "Industrial Design",
            "webhook": "Industrial Design",
            "localist": "Industrial Design",
            "courseCatalogue": "INDUSTRIAL DESIGN",
            "ektronNews": "Industrial Design"
        }, {
            "colleague": "Illustration",
            "webhook": "Illustration",
            "localist": "Illustration",
            "courseCatalogue": "ILLUSTRATION",
            "ektronNews": "Illustration"
        }, {
            "colleague": "Furniture Design",
            "webhook": "Furniture Design",
            "localist": "Furniture Design",
            "courseCatalogue": "FURNITURE DESIGN",
            "ektronNews": "Furniture Design"
        }, {
            "colleague": "Film/Anim/Video",
            "webhook": "Film / Animation / Video",
            "localist": "Film/Animation/Video",
            "courseCatalogue": "FILM/ANIMATION/VIDEO",
            "ektronNews": "Film-Animation-Video"
        }, {
            "colleague": "Ceramics Dept",
            "webhook": "Ceramics",
            "localist": "Ceramics",
            "courseCatalogue": "CERAMICS",
            "ektronNews": "Ceramics"
        }, {
            "colleague": "Architecture",
            "webhook": "Architecture",
            "localist": "Architecture",
            "courseCatalogue": "ARCHITECTURE",
            "ektronNews": "Architecture"
        }, {
            "colleague": "Graphic Design",
            "webhook": "Graphic Design",
            "localist": "Graphic Design",
            "courseCatalogue": "GRAPHIC DESIGN",
            "ektronNews": "Graphic Design"
        }, {
            "colleague": "Apparel Design",
            "webhook": "Apparel Design",
            "localist": "Apparel Design",
            "courseCatalogue": "APPAREL DESIGN",
            "ektronNews": "Apparel Design"
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
                'localist'),
        webhookLiberalArtsDepartmentForLocalist:
            forMapUsingKeyFindWebhookValue(
                'forLiberalArtsDepartments',
                'localist'),
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
                'colleague'),
        webhookDepartmentForEktronNews:
            forMapUsingKeyFindWebhookValue(
                'forDepartments',
                'ektronNews'),
        webhookLiberalArtsDepartmentForEktronNews:
            forMapUsingKeyFindWebhookValue(
                'forLiberalArtsDepartments',
                'ektronNews'),
        webhookInitiativeForEktronNews:
            forMapUsingKeyFindWebhookValue(
                'forInitiatives',
                'ektronNews')
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