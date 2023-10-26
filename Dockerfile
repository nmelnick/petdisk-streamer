FROM node:18

ENV TINI_VERSION v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

USER node
WORKDIR /usr/src/app
RUN mkdir /usr/src/app/library
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD [ "node", "petdisk.js" ]
