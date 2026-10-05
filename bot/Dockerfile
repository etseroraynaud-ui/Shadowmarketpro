# Image du bot Shock Engine : Node 22 exécute le TypeScript directement, avec le moteur partagé
# (lib/) et le bot (bot/). Construite depuis la racine du dépôt :
#   docker build -f bot/Dockerfile -t shock-engine-bot .
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app
# lib/ est en modules ES, comme bot/.
RUN echo '{"type":"module"}' > package.json
COPY bot/package.json bot/package-lock.json bot/
RUN cd bot && npm ci --omit=dev && npm cache clean --force
COPY lib lib
COPY bot/src bot/src

# Bougies, état et journal dans /data (volume : ils survivent aux redémarrages et mises à jour).
RUN mkdir -p /data && chown node:node /data
ENV BOT_DATA_DIR=/data/candles BOT_STATE_DIR=/data/state BOT_LOG_DIR=/data/logs
VOLUME /data

USER node
WORKDIR /app/bot
CMD ["node", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "src/main.ts"]
