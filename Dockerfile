# --- build the dashboard frontend ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test && npm run build

# --- runtime: server + built frontend only ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY shared ./shared
COPY --from=build /app/dist ./dist
RUN mkdir -p recordings && chown node:node recordings
USER node

# 5173 = dashboard (HTTP + WebSocket), 20777/udp = F1 telemetry
EXPOSE 5173 20777/udp
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:5173/ >/dev/null || exit 1
ENTRYPOINT ["node_modules/.bin/tsx", "server/index.ts"]
