#!/usr/bin/env bash

set -e

echo "update source"
git pull
chmod +x cmd.sh
npm install --only=production

echo "run app"
export GOOGLE_APPLICATION_CREDENTIALS="/google-keyfile.json"
node src/app.js
