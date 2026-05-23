#!/bin/sh
set -e
sed "s|__DEPLOY_SECRET__|${DEPLOY_SECRET:-}|g" /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec "$@"
