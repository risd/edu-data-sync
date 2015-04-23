var fs = require('fs');
var ndjson = require('ndjson');
var through = require('through2');
var moment = require('moment');
var snapshotPath = __dirname + '/snapshot.txt';



fs.createReadStream(snapshotPath)
	.pipe(ndjson.parse())
	.pipe(instances());

function instances () {
	return through.obj(
		function (row, enc, next) {
			row.event.event_instances.map(function (d) {
				console.log(d.event_instance.start);
				console.log(d.event_instance.end);
				console.log(d.event_instance.all_day);
				console.log(d.event_instance.id);
			});
			next();
		});
}	

function dater () {
	return through.obj(dtr);

	function dtr (row, enc, next) {
		var first = [row.event.first_date].map(addEndOfDay)[0];
		var last = [row.event.last_date].map(addEndOfDay)[0];
		console.log(moment(first).format("dddd, MMMM Do YYYY, h:mm:ss a"));
		// console.log(row.event.event_instances[0].event_instance.start);
		next();
	}
}

function uider () {
	var uids = {};
	return through.obj(
		function (row, enc, next) {
			if (Object.keys(uids).indexOf(row.event.title) === -1) {
				uids[row.event.title] = [];
			}
			uids[row.event.title].push(row.event.event_instances[0].event_instance.id);
			next();
		},
		function () {
			console.log(uids);
			this.push(uids);
			this.push(null);
		});
}


function checker () {
	return through.obj(function (row, enc, next) {
		if (row.event.first_date === '') {
			console.log('no first date');
		}
		if (row.event.last_date === '') {
			console.log('no last date');
		}
		if (row.event.event_instances.length > 1) {
			console.log('more than one event instance');
		}
		this.push(row);
		next();
	});
}

function addTimeZone (dateString) {
	return dateString + 'T00:00:00-04:00';
}

function addEndOfDay (dateString) {
    return dateString + 'T23:59:59-04:00';
}