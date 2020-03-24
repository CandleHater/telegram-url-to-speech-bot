const fs = require('fs');
const util = require('util');
const request = require('request');
const crypto = require('crypto');

const Telegraf = require('telegraf');
const cheerio = require('cheerio');
const unfluff = require('unfluff');

const textToSpeech = require('@google-cloud/text-to-speech');
const tts = new textToSpeech.TextToSpeechClient();

const { Translate } = require('@google-cloud/translate').v2;
const translate = new Translate();

// logger
// var logStdout = process.stdout;
// var logFile = fs.createWriteStream('debug.log', {
//     // w = override / a = append
//     flags: 'w'
// });

// console.error = console.log = function () {
//     const output = new Date().toISOString() + ' - '
//     + util.format.apply(null, arguments)
//     + '\n';

//     logStdout.write(output);
//     logFile.write(output);
// };

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
            console.log('process: extractedData ', extractedData);

            if (!extractedData) {
                this.updateStatusCallback('❌ text extraction failed, aborting.', true);
                return this.doneCallback();
            }

            const text = extractedData.text.substring(0, 5000);

            console.log('process: text ', text);

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
            const urlHash = crypto.createHash('md5').update(this.url).digest('hex')
            const fileName = './output/' + urlHash + '.mp3';
            const writeFile = util.promisify(fs.writeFile);

            await writeFile(fileName, response.audioContent, 'binary');

            return fileName;
        } catch(e) {
            return false
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
            request(this.url, {
                json: false
            }, (error, res, body) => {
                if (error) {
                    return reject(error);
                }

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

// DEV
// new URLToSpeech(
//     `
//     https://news.bitcoin.com/bulls-return-120-million-tether-bitcoin-halving/
//     `,
//     (message) => new Promise((resolve) => {
//         console.log(message);
//         resolve();
//     }),
//     console.log
//     ).process();


// Telegraf Telegram Client
const telegrafClient = new Telegraf(process.env.BOT_TOKEN);
const loadingEmoji = ['🕛','🕐','🕑','🕒','🕓','🕔','🕕','🕖','🕗','🕘','🕙','🕚'];

// on /start
telegrafClient.start(
    (ctx) => ctx.reply('Welcome 😄! Feel free to send me a link 🔗, I\'ll read out the content for you 🔊')
    );

// on message
telegrafClient.on('message', async (ctx) => {
    const startTime = new Date().getTime();
    const userMessage = ctx.message;
    let botMessageText = '<strong>' + loadingEmoji[0] + ' processing your request..</strong>\n';

    const telegrafMessageExtras = {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_to_message_id: userMessage.message_id
    };

    console.log('user message text "' + userMessage.text + '"');

    // easter egg
    if (userMessage.text && userMessage.text.toLowerCase() === 'bitcoin') {
        return ctx.replyWithAudio({
            source: 'bitconnect.mp3'
        }, Object.assign(telegrafMessageExtras, {
            title: 'To the moon 🌕',
            caption: 'Buy #Bitcoin!'
        })).catch(() => null);
    }

    // reply
    ctx.reply(botMessageText, telegrafMessageExtras).then((botMessage) => {
        let isUpdatingStatus = false;

        // callback - status update
        let updateStatusCallback = async (text, replace) => {
            if (isUpdatingStatus) {
                return setTimeout(() => updateStatusCallback(text, replace), 100);
            }

            isUpdatingStatus = true;

            // loader emoji
            if (!text) {
                text = botMessageText;
                replace = true;

                for (let i = 0; i < loadingEmoji.length; i++) {
                    if (botMessageText.indexOf(loadingEmoji[i]) === -1) {
                        continue;
                    }

                    text = text.replace(
                        loadingEmoji[i],
                        loadingEmoji[i === loadingEmoji.length - 1 ? 0 : i + 1]
                        );
                    break;
                }
            }
            console.log('updateStatusCallback: [chat ID ' + botMessage.chat.id + ']: ' + text);

            // replace text
            if (!replace) {
                text = botMessageText + '\n' + text;
            }

            // edit message
            ctx.telegram.editMessageText(
                botMessage.chat.id,
                botMessage.message_id,
                botMessage.message_id,
                text,
                telegrafMessageExtras
                )
            .then(() => {
                isUpdatingStatus = false;
            }, (error) => {
                isUpdatingStatus = false;
                console.log(error);
            });

            botMessageText = text;
        };

        // callback - done
        const doneCallback = async (audioFile, title, teaser) => {
            clearInterval(loadingInterval);
            // updateStatusCallback = () => null;

            if (!audioFile) {
                return;
            }

            // remove first two lines in current message
            let finalBotMessage = botMessageText.split('\n').splice(2).join('\n');

            // add teaser
            if (teaser) {
                finalBotMessage = '<em>' + teaser + '</em>\n\n' + finalBotMessage;
            }

            // add delivered
            const secondsSinceStart = (new Date().getTime() - startTime) / 1000;
            finalBotMessage += '\n✅ delivered within <em>' + secondsSinceStart + ' seconds</em>';

            // send audio reply
            ctx.replyWithAudio({
                source: audioFile
            }, Object.assign(telegrafMessageExtras, {
                title: title,
                caption: finalBotMessage
            })).then(() => {
                ctx.telegram.deleteMessage(botMessage.chat.id, botMessage.message_id);
                fs.unlink(audioFile, () => null);
            }, () => {
                updateStatusCallback('❌ couldn\'t sent audio, aborting.', true);
                fs.unlink(audioFile, () => null);
            });
        };

        // update for loading animation
        const loadingInterval = setInterval(() => updateStatusCallback(), 500);

        // process
        new URLToSpeech(
            userMessage.text,
            updateStatusCallback,
            doneCallback
            ).process();
    }, (error) => console.error(error));
});

// launch
telegrafClient.launch().then(
    () => console.log('Telegram client online'),
    () => console.error('ERROR: Telegram client couldn\'t start')
    );
