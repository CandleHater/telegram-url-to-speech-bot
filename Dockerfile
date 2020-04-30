FROM node:12

# create app directory
WORKDIR /usr/src/app
RUN mkdir -p ./output

# install app dependencies
COPY package*.json ./
RUN npm install --only=production

# bundle app source
COPY . .

# start
CMD export GOOGLE_APPLICATION_CREDENTIALS="/google-keyfile.json" && node src/app.js
