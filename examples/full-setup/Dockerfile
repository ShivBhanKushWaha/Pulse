# The example app (Express + Pulse SDK). Pulse's records are kept in /data/pulse-records.sqlite.
FROM node:22-alpine
WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

ENV NODE_ENV=production PULSE_RECORDS_DB=/data/pulse-records.sqlite
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 5000
# Any HTTP answer below 500 means the app is up (the example has no dedicated /health route).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \n  CMD node -e "fetch('http://127.0.0.1:5000/').then(r=>process.exit(r.status<500?0:1),()=>process.exit(1))"
CMD ["node", "dist/index.js"]
