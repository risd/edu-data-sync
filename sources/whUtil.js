var moment = require('moment');

module.exports = function () {
    var maps = {
        forInitiatives: [
            {
                "webhook": "Public Engagement",
                "ektronNews": "public engagement"
            }, {
                "webhook": "STEM to STEAM",
                "ektronNews": "STEAM"
            }
        ],
        forLiberalArtsDepartments: [
            {
                "workday": "Theory + History of Art + Design",
                "colleague": "History of Art & Visual Cultur",
                "webhook": "Theory + History of Art + Design",
                "localist": "History of Art + Visual Culture",
                "courseCatalogue": "HISTORY OF ART&VISUAL CULTURE",
                "ektronNews": "History of Art + Visual Culture",
                "courseCatalogueNameAbbreviation": "HAVC",
            }, {
                "workday": "Literary Arts + Studies",
                "colleague": "Literary Arts and Studies",
                "webhook": "Literary Arts + Studies",
                "localist": "Literary Arts + Studies",
                "courseCatalogue": "LITERARY ARTS AND STUDIES",
                "ektronNews": "Literary Arts + Studies",
                "courseCatalogueNameAbbreviation": "LAS",
            }, {
                "workday": "History Philosophy + the Social Sciences",
                "colleague": "History Phil Social Sciences",
                "webhook": "History, Philosophy + the Social Sciences",
                "localist": "History, Philosophy + the Social Sciences",
                "courseCatalogue": "HIST/PHIL/SO SC DEPT",
                "ektronNews": "History, Philosophy + the Social Sciences",
                "courseCatalogueNameAbbreviation": "HPSS",
            }
        ],
        forDepartments: [
            {
                "workday": "Textiles",
                "colleague": "Textiles",
                "webhook": "Textiles",
                "localist": "Textiles",
                "courseCatalogue": "TEXTILES",
                "ektronNews": "Textiles",
                "courseCatalogueNameAbbreviation": "TEXT",
            }, {
                "workday": "Painting",
                "colleague": "Painting",
                "webhook": "Painting",
                "localist": "Painting",
                "courseCatalogue": "PAINTING",
                "ektronNews": "Painting",
                "courseCatalogueNameAbbreviation": "PAINT",
            }, {
                "workday": "Glass",
                "colleague": "Glass",
                "webhook": "Glass",
                "localist": "Glass",
                "courseCatalogue": "GLASS",
                "ektronNews": "Glass",
                "courseCatalogueNameAbbreviation": "GLASS",
            }, {
                "workday": "Sculpture",
                "colleague": "Sculpture",
                "webhook": "Sculpture",
                "localist": "Sculpture",
                "courseCatalogue": "SCULPTURE",
                "ektronNews": "Sculpture",
                "courseCatalogueNameAbbreviation": "SCULP",
            }, {
                "workday": "Printmaking",
                "colleague": "Printmaking",
                "webhook": "Printmaking",
                "localist": "Printmaking",
                "courseCatalogue": "PRINTMAKING",
                "ektronNews": "Printmaking",
                "courseCatalogueNameAbbreviation": "PRINT",
            }, {
                "workday": "Photography",
                "colleague": "Photography",
                "webhook": "Photography",
                "localist": "Photography",
                "courseCatalogue": "PHOTOGRAPHY",
                "ektronNews": "Photography",
                "courseCatalogueNameAbbreviation": "PHOTO",
            }, {
                "workday": "Digital Media",
                "colleague": "Digital Media",
                "webhook": "Digital + Media",
                "localist": "Digital + Media",
                "courseCatalogue": "DIGITAL & MEDIA",
                "ektronNews": "Digital + Media",
                "courseCatalogueNameAbbreviation": "DM",
            }, {
                "workday": "Teaching + Learning in Art + Design",
                "colleague": "Teach Learn Art + Design",
                "webhook": "Teaching + Learning in Art + Design",
                "localist": "Teaching + Learning in Art + Design",
                "courseCatalogue": "TLAD TEACHING + LEARNING",
                "ektronNews": "Teaching + Learning in Art + Design",
                "courseCatalogueNameAbbreviation": "TLAD",
            }, {
                "workday": "Landscape Architecture",
                "colleague": "Landscape Architecture",
                "webhook": "Landscape Architecture",
                "localist": "Landscape Architecture",
                "courseCatalogue": "LANDSCAPE ARCH",
                "ektronNews": "Landscape Architecture",
                "courseCatalogueNameAbbreviation": "LDAR",
            }, {
                "workday": "Jewelry + Metalsmithing",
                "colleague": "Jewelry & Metalsmithing",
                "webhook": "Jewelry + Metalsmithing",
                "localist": "Jewelry + Metalsmithing",
                "courseCatalogue": "JEWELRY & METAL",
                "ektronNews": "Jewelry + Metalsmithing",
                "courseCatalogueNameAbbreviation": "J&M",
            }, {
                "workday": "Interior Architecture",
                "colleague": "Interior Architecture",
                "webhook": "Interior Architecture",
                "localist": "Interior Architecture",
                "courseCatalogue": "INTERIOR ARCH",
                "ektronNews": "Interior Architecture",
                "courseCatalogueNameAbbreviation": "INTAR",
            }, {
                "workday": "Industrial Design",
                "colleague": "Industrial Design",
                "webhook": "Industrial Design",
                "localist": "Industrial Design",
                "courseCatalogue": "INDUSTRIAL DESIGN",
                "ektronNews": "Industrial Design",
                "courseCatalogueNameAbbreviation": "ID",
            }, {
                "workday": "Illustration",
                "colleague": "Illustration",
                "webhook": "Illustration",
                "localist": "Illustration",
                "courseCatalogue": "ILLUSTRATION",
                "ektronNews": "Illustration",
                "courseCatalogueNameAbbreviation": "ILLUS",
            }, {
                "workday": "Furniture Design",
                "colleague": "Furniture Design",
                "webhook": "Furniture Design",
                "localist": "Furniture Design",
                "courseCatalogue": "FURNITURE DESIGN",
                "ektronNews": "Furniture Design",
                "courseCatalogueNameAbbreviation": "FURN",
            }, {
                "workday": "Film/Animation/Video",
                "colleague": "Film/Animation/Video",
                "webhook": "Film / Animation / Video",
                "localist": "Film/Animation/Video",
                "courseCatalogue": "FILM/ANIMATION/VIDEO",
                "ektronNews": "Film-Animation-Video",
                "courseCatalogueNameAbbreviation": "FAV",
            }, {
                "workday": "Ceramics",
                "colleague": "Ceramics",
                "webhook": "Ceramics",
                "localist": "Ceramics",
                "courseCatalogue": "CERAMICS",
                "ektronNews": "Ceramics",
                "courseCatalogueNameAbbreviation": "CER",
            }, {
                "workday": "Department of Architecture",
                "colleague": "Department of Architecture",
                "webhook": "Architecture",
                "localist": "Architecture",
                "courseCatalogue": "ARCHITECTURE",
                "ektronNews": "Architecture",
                "courseCatalogueNameAbbreviation": "ARCH",
            }, {
                "workday": "Graphic Design",
                "colleague": "Graphic Design",
                "webhook": "Graphic Design",
                "localist": "Graphic Design",
                "courseCatalogue": "GRAPHIC DESIGN",
                "ektronNews": "Graphic Design",
                "courseCatalogueNameAbbreviation": "GRAPH",
            }, {
                "workday": "Apparel Design",
                "colleague": "Apparel Design",
                "webhook": "Apparel Design",
                "localist": "Apparel Design",
                "courseCatalogue": "APPAREL DESIGN",
                "ektronNews": "Apparel Design",
                "courseCatalogueNameAbbreviation": "APPAR",
            }
        ],
        forFoundationStudies: [{
            "workday": "Division of Foundation Studies",
            "colleague": "Experimental and Found Studies",
            "courseCatalogue": "Foundation Studies",
            "webhook": "Experimental and Foundation Studies",
            "localist": "Division of Foundation Studies",
            "courseCatalogueNameAbbreviation": "FOUND",
        }],
        forFoundationStudiesConcentrations: [{
            "courseCatalogue": "EXPERIMENTAL,FOUNDATION STUDY",
            "webhook": "Experimental and Foundation Studies",
            "courseCatalogueNameAbbreviation": "",
        }],
        forGraduateStudies: [{
            "workday": "Graduate Commons",
            "colleague": "Graduate Studies",
            "courseCatalogue": "GRADUATE STUDIES",
            "webhook": "Graduate Studies",
            "localist": "Division of Graduate Studies",
            "courseCatalogueNameAbbreviation": "GRAD",
        }]
    };

    return {
        guid: guid,
        getKey: getKey,
        formattedDate: formattedDate,
        whRequiredDates: whRequiredDates,
        webhookDepartmentForCourseCatalogue:
            forMapUsingKeyFindWebhookValue(
                'forDepartments',
                'courseCatalogue'),
        webhookLiberalArtsDepartmentForCourseCatalogue:
            forMapUsingKeyFindWebhookValue(
                'forLiberalArtsDepartments',
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
        webhookLiberalArtsDepartmentForColleague:
            forMapUsingKeyFindWebhookValue(
                'forLiberalArtsDepartments',
                'colleague'),

        webhookDepartmentForWorkday:
            forMapUsingKeyFindWebhookValue(
                'forDepartments',
                'workday'),
        webhookLiberalArtsDepartmentForWorkday:
            forMapUsingKeyFindWebhookValue(
                'forLiberalArtsDepartments',
                'workday'),

        webhookDepartmentForCourseCatalogueNameAbbreviation:
            forMapUsingKeyFindWebhookValue(
                'forDepartments',
                'courseCatalogueNameAbbreviation'),
        webhookLiberalArtsDepartmentForCourseCatalogueNameAbbreviation:
            forMapUsingKeyFindWebhookValue(
                'forLiberalArtsDepartments',
                'courseCatalogueNameAbbreviation'),
        webhookFoundationStudiesForCourseCatalogueNameAbbreviation:
            valueForMapAndKey(
                'forFoundationStudies',
                'courseCatalogueNameAbbreviation'),
        webhookGraduateStudiesForCourseCatalogueNameAbbreviation:
            valueForMapAndKey(
                'forGraduateStudies',
                'courseCatalogueNameAbbreviation'),

        colleagueFoundationStudies:
            valueForMapAndKey(
                'forFoundationStudies',
                'colleague'),
        colleagueGraduateStudies:
            valueForMapAndKey(
                'forGraduateStudies',
                'colleague'),

        workdayFoundationStudies:
            valueForMapAndKey(
                'forFoundationStudies',
                'workday'),
        workdayGraduateStudies:
            valueForMapAndKey(
                'forGraduateStudies',
                'workday'),

        courseCatalogueFoundationStudies:
            valueForMapAndKey(
                'forFoundationStudies',
                'courseCatalogue'),
        courseCatalogueGraduateStudies:
            valueForMapAndKey(
                'forGraduateStudies',
                'courseCatalogue'),

        courseCatalogueFoundationStudiesConcentrations:
            valueForMapAndKey(
                'forFoundationStudiesConcentrations',
                'courseCatalogue'),

        localistFoundationStudies:
            valueForMapAndKey(
                'forFoundationStudies',
                'localist'),
        localistGraduateStudies:
            valueForMapAndKey(
                'forGraduateStudies',
                'localist'),

        allColleagueDepartments:
            allKeyValuesInMaps(
                [ 'forDepartments',
                  'forLiberalArtsDepartments',
                  'forFoundationStudies',
                  'forGraduateStudies' ],
                'colleague' ),

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
                'ektronNews'),

        valueForCombinedMap: valueForCombinedMap
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

    function valueForCombinedMap (compareKey, returnKey) {
        if (returnKey === undefined) {
            returnKey = 'webhook';
        }
        var combined = [].concat(
            maps.forLiberalArtsDepartments,
            maps.forDepartments,
            maps.forFoundationStudies,
            maps.forGraduateStudies);

        return function withValue (compareValue) {
            var f = combined
                .filter(function (d) {
                    return d[compareKey] === compareValue;
                })
                .map(function (d) {
                    return d[returnKey];
                });

            if (f.length === 0) {
                return false;
            } else {
                return f[0];
            }
        }
    }

    function allKeyValuesInMaps (mapsOfInterest, key) {
        var aggregateMaps = [];
        mapsOfInterest.forEach(function (mapOfInterest){
            aggregateMaps = aggregateMaps.concat(maps[mapOfInterest])
        });
        return aggregateMaps.map(function valueInMap(mapping) {
            return mapping[key];
        });
    }

    function valueForMapAndKey (mapOfInterest, key) {
        return maps[mapOfInterest][0][key];
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

    if ( ! d.hasOwnProperty( 'create_date' ) ) d.create_date = formattedDate(time);
    d.publish_date = formattedDate(time);
    d.last_updated = formattedDate(time);
    if ( ! d.hasOwnProperty( '_sort_create_date' ) ) d._sort_create_date = time.getTime();
    d._sort_last_updated = time.getTime();
    d._sort_publish_date = time.getTime();
    if ( ! d.hasOwnProperty( 'preview_url' ) ) d.preview_url = guid();

    return d;
}