#!/bin/bash
NOW=$(date +"%Y-%m-%d--%T")
FILENAME="EMPLOYEE.DATA.$NOW.XML"
curl -o $FILENAME https://s3.amazonaws.com/from-oit-for-edu/EMPLOYEE.DATA.XML
