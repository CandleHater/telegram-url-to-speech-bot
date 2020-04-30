#!/bin/bash

echo "# update source"
git pull
chmod +x cmd.sh
echo

echo "# update dependencies"
npm install --only=production
echo

echo "# run app"
export GOOGLE_APPLICATION_CREDENTIALS="/google-keyfile.json"
node src/app.js
echo
