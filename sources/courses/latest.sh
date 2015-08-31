#!/usr/bin/env bash
current_time=$(date "+%Y.%m.%d-%H.%M.%S")
curl -o COURSE.DATA.${current_time}.XML https://s3.amazonaws.com/from-oit-for-edu/COURSE.DATA.XML
curl -o ENGL.COURSE.DATA.${current_time}.XML https://s3.amazonaws.com/from-oit-for-edu/ENGL.COURSE.DATA.XML