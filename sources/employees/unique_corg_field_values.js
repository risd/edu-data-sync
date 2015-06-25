var fs = require('fs');
var values = fs
		.readFileSync(__dirname + '/corg_field_values.txt')
		.toString()
		.split('\n')
		.map(function (line) { return line.split(';'); })
		.reduce(function (a, b) {
			return a.concat(b);
		})
		.map(function (item) { return item.trim(); });

var u = unique(values);

var w = fs.createWriteStream(
	__dirname + '/corg_field_values_unique.txt');

u.map(function (d) { w.write(d + '\n'); });
w.end();

function unique (val) {
	var u = [];
	
	val.forEach(function (d) {
		if (u.indexOf(d) === -1) {
			u.push(d)
		}
	});

	return u;
}