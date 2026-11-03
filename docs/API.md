# API VoxDesk

Описание REST-эндпоинтов. Все пути начинаются с `/api`. Формат ответов —
единый (см. [ARCHITECTURE.md](ARCHITECTURE.md#единый-формат-ответов-api)).

**Базовый адрес в разработке:** `http://localhost:4000`

## Аутентификация

Защищённые эндпоинты требуют заголовок:

```
Authorization: Bearer <accessToken>
```

Права указаны у каждого эндпоинта: `Все` — любой вошедший, `admin`,
`supervisor`, `admin + supervisor`. Если прав не хватает — `403 FORBIDDEN`.

---

## Auth — вход и регистрация

| Метод | Путь | Доступ | Описание |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Все | Регистрация (роль всегда `agent`) |
| POST | `/api/auth/login` | Все | Вход |
| POST | `/api/auth/refresh` | Все | Обновление access-токена |
| POST | `/api/auth/logout` | Все | Выход (отзыв refresh-токена) |
| GET | `/api/auth/me` | Все | Текущий пользователь |

**POST `/api/auth/register`**
```json
{ "email": "user@example.com", "password": "password123", "fullName": "Иван Иванов" }
```
Ответ `201`:
```json
{
  "data": {
    "user": { "id": 7, "email": "user@example.com", "fullName": "Иван Иванов", "role": "agent", "status": "offline" },
    "accessToken": "eyJ…",
    "refreshToken": "…"
  }
}
```

**POST `/api/auth/login`**
```json
{ "email": "admin@voxdesk.local", "password": "demo12345" }
```
Ответ `200` — тот же формат, что у регистрации. При неверных данных — `401`
`UNAUTHORIZED` с сообщением «Неверный e-mail или пароль» (без уточнения, что
именно неверно — так безопаснее).

Refresh-токен дополнительно кладётся в httpOnly-куку `voxdesk_refresh`, поэтому
в браузере обновление сессии работает «само». Для не-браузерных клиентов токен
можно передать в теле запроса.

---

## Users — сотрудники

| Метод | Путь | Доступ | Описание |
| --- | --- | --- | --- |
| GET | `/api/users` | Все | Список с поиском и фильтром по роли |
| GET | `/api/users/:id` | Все | Один сотрудник |
| POST | `/api/users` | admin | Создать сотрудника |
| PATCH | `/api/users/:id` | admin + supervisor | Изменить (роль — только admin) |
| POST | `/api/users/me/password` | Все | Сменить свой пароль |
| DELETE | `/api/users/:id` | admin | Удалить (нельзя себя) |

Параметры списка: `search`, `role`, `page`, `limit`.
Создание:
```json
{ "email": "agent7@voxdesk.local", "password": "password123", "fullName": "Пётр Петров", "role": "agent" }
```
Смена пароля:
```json
{ "currentPassword": "password123", "newPassword": "newPassword456" }
```
После смены пароля все сессии пользователя сбрасываются — это осознанное
решение в пользу безопасности.

---

## Contacts — контакты

| Метод | Путь | Доступ | Описание |
| --- | --- | --- | --- |
| GET | `/api/contacts` | Все | Список с поиском/тегом/сортировкой |
| GET | `/api/contacts/:id` | Все | Один контакт |
| POST | `/api/contacts` | Все | Создать |
| PATCH | `/api/contacts/:id` | admin + supervisor | Изменить |
| DELETE | `/api/contacts/:id` | admin + supervisor | Удалить |

Параметры списка: `search` (по имени/телефону/компании), `tag`, `sort`
(`name` | `created` | `company`), `page`, `limit`.
Создание:
```json
{ "fullName": "Мария Смирнова", "phone": "+7 999 123-45-67", "email": "maria@company.ru", "company": "ООО Ромашка", "tags": ["vip"], "notes": "Ключевой клиент" }
```
Телефон должен быть уникальным — повтор даёт `409 CONFLICT`.

---

## Queues — очереди распределения

| Метод | Путь | Доступ | Описание |
| --- | --- | --- | --- |
| GET | `/api/queues` | Все | Список очередей |
| GET | `/api/queues/:id` | Все | Одна очередь |
| POST | `/api/queues` | admin + supervisor | Создать |
| PATCH | `/api/queues/:id` | admin + supervisor | Изменить |
| DELETE | `/api/queues/:id` | admin + supervisor | Удалить |

Стратегии (`strategy`): `longest_idle` (дольше всех ждёт), `round_robin`
(по кругу), `ring_all` (все одновременно).
```json
{ "name": "Отдел продаж", "strategy": "round_robin", "description": "Первая линия", "isActive": true }
```

---

## Calls — звонки

| Метод | Путь | Доступ | Описание |
| --- | --- | --- | --- |
| GET | `/api/calls/summary` | Все | Сводка (для дашборда) |
| GET | `/api/calls/activity?days=14` | Все | Активность по дням |
| GET | `/api/calls` | Все | Журнал с фильтрами |
| POST | `/api/calls` | Все | Зарегистрировать звонок |
| GET | `/api/calls/:id` | Все | Один звонок с именами |
| PATCH | `/api/calls/:id` | Все | Обновить звонок |

> Порядок важен: `/summary` и `/activity` объявлены до `/:id`, иначе Express
> принял бы слово «summary» за идентификатор.

Параметры журнала: `direction` (`inbound` | `outbound`), `status`, `queueId`,
`agentId`, `contactId`, `from`, `to`, `page`, `limit`.

Создание звонка:
```json
{ "direction": "inbound", "status": "completed", "phoneNumber": "+7 999 123-45-67", "durationSec": 180, "queueId": 1 }
```
Если номер совпадает с контактом из справочника — звонок автоматически
привяжется к нему.

Сводка (`/summary`):
```json
{
  "data": {
    "total": 142, "answered": 120, "missed": 22,
    "answerRate": 84.5, "missRate": 15.5,
    "totalTalkSeconds": 25200, "averageTalkSeconds": 210,
    "statuses": { "completed": 120, "missed": 22, "…": 0 }
  }
}
```

Активность (`/activity?days=7`):
```json
{ "data": [ { "date": "2026-10-28", "inbound": 12, "outbound": 7 }, … ] }
```

---

## Analytics — аналитика

Доступ: **admin + supervisor**.

| Метод | Путь | Описание |
| --- | --- | --- |
| GET | `/api/analytics/dashboard` | Всё для дашборда одним запросом |
| GET | `/api/analytics/agents` | Эффективность операторов |
| GET | `/api/analytics/queues` | Загрузка очередей |
| GET | `/api/analytics/hourly` | Распределение по часам (24 точки) |
| GET | `/api/analytics/activity?limit=20` | Лента событий |

`/dashboard` собирает в одном ответе `agents`, `queues`, `hourly` и
`recentActivity` — чтобы первый экран грузился одним запросом, а не четырьмя.

---

## Служебные

| Метод | Путь | Доступ | Описание |
| --- | --- | --- | --- |
| GET | `/api/health` | Все | Проверка работоспособности (`{ "status": "ok", "uptime": … }`) |

Ограничение частоты запросов: до 300 запросов за 15 минут на всё API и до 10
попыток входа/регистрации за 15 минут. При превышении — `429 RATE_LIMITED`.
