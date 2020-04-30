const fs = require('fs');
const util = require('util');

const crypto = require('crypto');
const fetch = require('node-fetch');
const unfluff = require('unfluff');
const cheerio = require('cheerio');

const textToSpeech = require('@google-cloud/text-to-speech');
const tts = new textToSpeech.TextToSpeechClient();

const { Translate } = require('@google-cloud/translate').v2;
const translate = new Translate();

class URLToSpeech {
    constructor(textWithURL, updateStatusCallback, doneCallback) {
        this.url = this.extractURL(textWithURL);
        this.updateStatusCallback = updateStatusCallback;
        this.doneCallback = doneCallback;
    }

    async process() {
        // validate
        if (!this.url) {
            this.updateStatusCallback('❌ couldn\'t find an URL, aborting.', true);
            return this.doneCallback();
        }

        this.updateStatusCallback('🔗 found a valid <a href="' + this.url + '">URL</a>');

        // get HTML
        this.getHtml().then(async (html) => {
            // size in kB
            const kbSize = parseInt((encodeURI(html).split(/%..|./).length - 1) / 1000);
            this.updateStatusCallback('🌐 download finished <em>[~' + kbSize + ' kB]</em>');

            // console.log('process: html', html);

            // extract text
            const extractedData = this.htmlExtractData(html);
            // console.log('process: extractedData ', extractedData);

            if (!extractedData) {
                this.updateStatusCallback('❌ text extraction failed, aborting.', true);
                return this.doneCallback();
            }

            const text = extractedData.text.substring(0, 5000);
            // console.log('extracted text: "' + text + '"');

            const wordCount = text.split(' ').length;
            this.updateStatusCallback(
                '📃 text extracted <em>['
                + (text.length === 5000 ? 'truncated to ' : '')
                + wordCount + ' words / '
                + text.length.toLocaleString() + ' characters'
                + ']</em>'
                );

            // detect language
            const [detection] = await translate.detect(
                text.substring(0, 250)
                );

            let language = Array.isArray(detection) ? detection[0].language : detection.language;
            if (!language) {
                language = extractedData.language;
            }

            this.updateStatusCallback('🏳 language detected <em>[' + language.toUpperCase() + ']</em>');

            // generate audio
            const audioFile = await this.textToSpeech(
                text,
                language
                );
            if (!audioFile) {
                this.updateStatusCallback('❌ audio generation failed, aborting.', true);
                return this.doneCallback();
            }

            this.updateStatusCallback('🔊 audio generated');
            this.doneCallback(audioFile, extractedData.title, extractedData.teaser);
        }, (error) => {
            this.updateStatusCallback('❌ text download failed, aborting.', true);
            this.doneCallback();

            console.error(error);
        });
    }

    async textToSpeech(text, language) {
        // language
        if (!language) {
            language = 'en-US';

        } else if (language.indexOf('de') === 0) {
            language = 'de-DE';

        } else if (language.indexOf('en') === 0) {
            language = 'en-US';
        }

        // TTS
        try {
            const [response] = await tts.synthesizeSpeech({
                input: {
                    text: text.slice(0, 5000)
                },
                voice: {
                    languageCode: language,
                    alternativeLanguageCodes: ['en-US', 'de-DE'],
                    ssmlGender: 'NEUTRAL'
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    pitch: 0,
                    speakingRate: 1.15
                }
            });

            // save file
            const urlHash = crypto.createHash('md5').update(this.url).digest('hex');
            const fileName = './output/' + urlHash + '.mp3';
            const writeFile = util.promisify(fs.writeFile);

            await writeFile(fileName, response.audioContent, 'binary');

            return fileName;
        } catch(e) {
            console.error(e);
            return false;
        }
    }

    htmlExtractData(html) {
        const $ = cheerio.load(html);

        // convert headlines to paragraphs for unfluff
        const headlineElements = $('h1, h2, h3, h4, h5, h6');
        headlineElements.each((i, element) => {
            const elementObject = $(element);
            let elementText = elementObject.text();

            // add "." to the end
            const lastChar = elementText.charAt(elementText.length - 1);
            if (['.', '!', '?'].indexOf(lastChar) === -1) {
                elementText += '.';
            }

            // replace
            elementObject.replaceWith('<p> ' + elementText + ' </p>');
        });

        const htmlFormatted = $.html();

        // extract
        const extractedData = unfluff(htmlFormatted);
        if (!extractedData || extractedData.text.length < 10) {
            return false;
        }

        // title
        let title = extractedData.softTitle;
        if (!title) {
            title = extractedData.title;
        }
        if (!title) {
            title = 'Read Out';
        }

        // result
        return {
            title: title,
            text: extractedData.text,
            language: extractedData.lang,
            teaser: extractedData.description
        };
    }

    getHtml() {
        return new Promise((resolve, reject) => {
            fetch(this.url)
            .then(res => res.text(), reject)
            .then((body) => {
                if (!body
                    || typeof body !== 'string'
                    || body.length < 20)
                {
                    return reject('no HTML found');
                }

                resolve(body);
            }, reject);
        });
    }

    extractURL(text) {
        if (typeof text !== 'string') {
            return false;
        }

        const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        const urlMatches = text.match(urlRegex);

        if (!urlMatches || urlMatches.length === 0) {
            return false;
        }

        return urlMatches[0];
    }
}

module.exports = URLToSpeech;
