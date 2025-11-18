FROM node:24-alpine AS base

WORKDIR /app

RUN npm install -g pnpm 

COPY scripts/ /app/scripts
COPY src/ /app/src
COPY witnet/ /app/witnet
COPY .no-postinstall /app
COPY package.json /app
COPY tsconfig.json /app
COPY pnpm-lock.yaml /app

RUN pnpm install --frozen-lockfile 

CMD ["node", "/app/src/bin/bots/watcher.cjs"] 
