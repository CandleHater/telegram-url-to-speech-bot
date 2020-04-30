FROM node:12

WORKDIR /usr/src/app

RUN git clone https://github.com/CandleHater/telegram-url-to-speech-bot.git /usr/src/app
RUN mkdir -p ./output

CMD ["./cmd.sh"]
