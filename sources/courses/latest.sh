#!/bin/bash
NOW=$(date +"%Y-%m-%d--%T")
FILENAME="COURSE.DATA.$NOW.XML"
curl -o $FILENAME https://s3.amazonaws.com/from-oit-for-edu/COURSE.DATA.XML
FILENAME="ENGL.COURSE.DATA.$NOW.XML"
curl -o $FILENAME https://s3.amazonaws.com/from-oit-for-edu/ENGL.COURSE.DATA.XML
