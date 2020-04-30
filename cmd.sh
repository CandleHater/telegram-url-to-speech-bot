#!/usr/bin/env bash

set -e

# update source
echo "update source"
git pull
npm install --only=production

# run
export GOOGLE_APPLICATION_CREDENTIALS="/google-keyfile.json"
node src/app.js
