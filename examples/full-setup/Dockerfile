# The example app (Express + Pulse SDK). Pulse's records are kept in /data/pulse-records.sqlite.
FROM node:22-alpine
WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

ENV NODE_ENV=production PULSE_RECORDS_DB=/data/pulse-records.sqlite
VOLUME /data
EXPOSE 5000
CMD ["node", "dist/index.js"]
