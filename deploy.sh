#!/bin/bash
set -e
cd /var/www/html/sftbeta
git pull
npm install --legacy-peer-deps
npm run build
pm2 restart sftbeta

