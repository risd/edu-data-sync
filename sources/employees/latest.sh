#!/usr/bin/env bash
current_time=$(date "+%Y.%m.%d-%H.%M.%S")
curl -o EMPLOYEE.DATA.${current_time}.XML https://s3.amazonaws.com/from-oit-for-edu/EMPLOYEE.DATA.XML