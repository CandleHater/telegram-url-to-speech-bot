# Setup
## Google Console
1. [Create a new project](https://console.cloud.google.com/projectcreate)
2. Enable [Text-to-Speech](https://console.cloud.google.com/apis/api/texttospeech.googleapis.com/overview) and [Translation](https://console.cloud.google.com/apis/api/translate.googleapis.com/overview) API
3. [Download key file](https://console.cloud.google.com/apis/credentials/serviceaccountkey) (JSON) 

## Telegram Bot
<<<<<<< HEAD
1. [Create a Bot](https://core.telegram.org/bots#3-how-do-i-create-a-bot)
=======
1. [Create a Bot]([https://core.telegram.org/bots#3-how-do-i-create-a-bot](https://core.telegram.org/bots#3-how-do-i-create-a-bot)
>>>>>>> master
2. Get the bots token

## Docker Run
Set *TELEGRAM_BOT_TOKEN* and *GOOGLE_KEYFILE_PATH* according to your credentials.

    $ docker run \
        -e BOT_TOKEN="[TELEGRAM_BOT_TOKEN]" \
        -v [GOOGLE_KEYFILE_PATH]:/google-keyfile.json \
        candlehater/telegram-url-to-speech
