FROM node:12

WORKDIR /usr/src/app
COPY cmd.sh cmd.sh

RUN git clone https://github.com/CandleHater/telegram-url-to-speech-bot.git /tmp/telegram-url-to-speech-bot
RUN cp -a /tmp/telegram-url-to-speech-bot/* /usr/src/app
RUN chmod +x cmd.sh
RUN mkdir -p ./output

CMD ["cmd.sh"]
