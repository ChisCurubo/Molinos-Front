# Contexto de build = raíz del repo (ver docker-compose.yml).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# vite build directo (no `npm run build`): en el servidor no hace falta `tsc -b` y la VM tiene poca RAM.
ENV VITE_API_URL=/api/v1
RUN npx vite build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY deploy/Caddyfile.* /etc/caddy/
