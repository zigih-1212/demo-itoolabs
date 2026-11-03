# syntax=docker/dockerfile:1
#
# Dockerfile для frontend-приложения VoxDesk.
#
# Схема как у backend: сначала собираем статику (Vite), затем отдаём её
# через nginx. Vite превращает Vue-компоненты в статические HTML/CSS/JS,
# а nginx — быстрый и предсказуемый веб-сервер для них.

# --- Этап 1: сборка статики ---
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/

RUN npm ci

COPY frontend ./frontend
# Сборка фронтенда обращается к API по относительному пути /api (см. .env.example),
# поэтому адрес backend не «вшивается» в бандл — проксированием занимается nginx.
RUN npm run build --workspace @voxdesk/frontend

# --- Этап 2: веб-сервер ---
FROM nginx:1.27-alpine AS runner

# Свой конфиг nginx: раздача статики + проксирование /api на backend-контейнер.
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
