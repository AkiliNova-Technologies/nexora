FROM node:24.11.1-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24.11.1-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gosu && rm -rf /var/lib/apt/lists/* && useradd --system --uid 10001 --create-home bridge
COPY --from=build --chown=bridge:bridge /app/package.json /app/package-lock.json ./
COPY --from=build --chown=bridge:bridge /app/node_modules ./node_modules
COPY --from=build --chown=bridge:bridge /app/dist ./dist
COPY --chown=root:root entrypoint.sh /usr/local/bin/nexora-bridge-entrypoint
RUN chmod 0755 /usr/local/bin/nexora-bridge-entrypoint
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/nexora-bridge-entrypoint"]
