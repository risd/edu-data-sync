/*

Courses from Ellucian. Each 

*/

module.exports = Courses;

function Courses () {
    if (!(this instanceof Courses)) return new Courses();
    var self = this;
    this.namespace = 'courses';
}