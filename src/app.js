const fs = require('fs');

const Telegraf = require('telegraf');
const URLToSpeech = require('./URLToSpeech');

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

    console.log('\nuser message text "' + userMessage.text + '"');

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
            updateStatusCallback = () => null;

            console.log('done [chat ID ' + botMessage.chat.id + ']: ' + botMessageText);

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
                // fs.unlink(audioFile, () => null);
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
