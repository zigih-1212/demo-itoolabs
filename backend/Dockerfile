# syntax=docker/dockerfile:1
#
# Dockerfile для backend-сервиса VoxDesk.
#
# Используем многоступенчатую сборку (multi-stage):
#   1) builder — ставит все зависимости и компилирует TypeScript в JavaScript;
#   2) runner  — берёт только собранный код и продакшн-зависимости.
# Так финальный образ получается компактным и без лишних инструментов,
# которые не нужны в рантайме (компилятор, тесты, dev-зависимости).

# --- Этап 1: сборка ---
FROM node:22-alpine AS builder
WORKDIR /app

# Сначала копируем только манифесты — так Docker закэширует слой установки
# зависимостей и не будет переустанавливать их при каждом изменении кода.
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

# Устанавливаем зависимости всего монорепозитория (npm workspaces).
RUN npm ci

# Копируем исходники backend и собираем.
COPY backend ./backend
RUN npm run build --workspace @voxdesk/backend

# --- Этап 2: рантайм ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Продакшн-зависимости: --omit=dev убирает devDependencies.
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm ci --omit=dev && npm cache clean --force

# Забираем результат сборки из builder-этапа.
COPY --from=builder /app/backend/dist ./backend/dist

# Каталог для файла базы данных (монтируется томом в docker-compose).
RUN mkdir -p /app/data
WORKDIR /app/backend

# Запускаем от непривилегированного пользователя — базовый принцип безопасности.
USER node
EXPOSE 4000

CMD ["node", "dist/index.js"]
