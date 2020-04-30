FROM node:12

WORKDIR /usr/src/app
COPY cmd.sh cmd.sh

RUN git clone https://github.com/CandleHater/telegram-url-to-speech-bot.git /tmp/telegram-url-to-speech-bot
RUN cp -rf /tmp/telegram-url-to-speech-bot/* /usr/src/app
RUN cp -rf /tmp/telegram-url-to-speech-bot/.git /usr/src/app
RUN mkdir -p ./output

ADD cmd.sh ./cmd.sh
RUN chmod +x cmd.sh

CMD ["/bin/bash", "/usr/src/app/cmd.sh"]
