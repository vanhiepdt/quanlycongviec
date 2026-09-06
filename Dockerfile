# =============================================================================
# Ảnh chạy THẬT của hệ thống (Phase 8 việc 2) — nginx vẫn chạy TRÊN HOST nên ảnh
# này chỉ chứa API Node. Dựng qua deploy/docker-compose.yml; ngữ cảnh dựng là GỐC
# repo (xem .dockerignore — chỉ server/package*.json, server/src, server/scripts
# được COPY vào).
#
# Hai tầng — cả hai đều node:24-alpine vì @node-rs/bcrypt là module có sẵn bản
# biên dịch theo nền tảng (musl), đổi nền tảng giữa hai tầng là hỏng:
#   deps    — npm ci --omit=dev từ package-lock.json (khóa đúng phiên bản).
#   runtime — chỉ src + node_modules + scripts, chạy bằng user `node` (non-root).
#
# node-pg-migrate cố ý nằm trong dependencies (không phải devDependencies) để chạy
# được `npm run migrate:up` ngay TRONG container app lúc triển khai (Phase 8 việc 3).
# scripts/zalo-*.mjs cũng ở trong ảnh để chạy zalo:kiem / zalo:webhook trên VPS
# bằng `docker compose exec app ...` (Phase 8 việc 6).
# =============================================================================

FROM node:24-alpine AS deps
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY server/package.json ./
COPY server/src ./src
COPY server/scripts ./scripts
USER node
EXPOSE 3000
# Alpine không có curl — wget của busybox đủ cho /healthz (app.js, không cần phiên).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "src/server.js"]
