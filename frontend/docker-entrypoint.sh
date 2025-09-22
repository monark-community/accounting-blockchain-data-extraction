#!/usr/bin/env bash
set -e

# Default if not provided
: "${BACKEND_URL:=http://backend:8080}"

# Render final Nginx config from the template
envsubst '${BACKEND_URL}' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/conf.d/default.conf

# Start Nginx
exec nginx -g 'daemon off;'
