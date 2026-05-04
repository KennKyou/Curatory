FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NITRO_PRESET=node-server
RUN npm run build

FROM node:22-slim

WORKDIR /app

COPY --from=build /app/.output .output

ENV HOST=0.0.0.0
ENV PORT=8080
ENV NODE_OPTIONS="--max-old-space-size=512"
EXPOSE 8080

CMD ["node", ".output/server/index.mjs"]
