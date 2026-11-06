# Vertex Pakistan entrypoint. Build: render tools.json into static files. Run: nginx, a few MB of memory.
FROM node:22-alpine AS build
WORKDIR /app
COPY tools.json nginx.conf ./
COPY scripts ./scripts
COPY src ./src
RUN node scripts/build.mjs

FROM nginx:1.27-alpine
RUN apk add --no-cache curl
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 scripts/status-loop.sh /docker-entrypoint.d/40-status-loop.sh
COPY --from=build /app/dist/tools.txt /etc/entrypoint/tools.txt
COPY --from=build /app/dist/ /usr/share/nginx/html/
RUN rm /usr/share/nginx/html/tools.txt
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/health || exit 1
