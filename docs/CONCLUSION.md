# MCP Manager - Заключение и план работы

## Статус проекта

### ✅ Что полностью готово

#### Backend (HTTP API Server)
- [x] HTTP сервер на localhost:4040
- [x] WebSocket для real-time событий
- [x] Все CRUD операции для серверов
- [x] Все CRUD операции для workspaces (Virtual Profiles)
- [x] Session management для IDE extensions
- [x] Process Manager - запуск/остановка MCP серверов
- [x] Port Manager - выделение портов
- [x] Secret Store - хранение секретов в OS keychain
- [x] MCP Gateway - проксирование запросов к серверам
- [x] Health checking серверов
- [x] Поддержка npx/pnpx/yarn/bunx/local типов установки

#### Virtual Profiles (VP) - Подключение
- [x] `POST /api/sessions/connect` - подключение IDE по projectRoot
- [x] Автоматическое создание VP если не существует
- [x] Поиск VP по пути (`findByProjectRoot`)
- [x] `GET /api/workspaces/by-path?path=...` - проверка существования VP (новый эндпоинт)
- [x] Heartbeat механизм (`POST /api/sessions/ping`)
- [x] Возврат списка MCP серверов для workspace

#### Electron App (Базовая структура)
- [x] Main process с IPC
- [x] Preload скрипт для безопасного IPC
- [x] Запуск McpHost при старте приложения
- [x] React renderer setup

---

### 🔄 Что в процессе / требует доработки

#### UI Компоненты (60% готово)
- [x] Sidebar с навигацией
- [x] ServerList и ServerCard
- [x] ServerDetailPage (базовая версия)
- [ ] **SecretsView** - нужен полный редизайн
- [ ] **AddServerModal** - модальное окно добавления сервера
- [ ] **ServerConfigModal** - редактирование конфигурации
- [ ] **AddWorkspaceModal** - создание workspace
- [ ] Loading states для всех компонентов
- [ ] Empty states

#### Система уведомлений (0% готово)
- [ ] Toast компонент
- [ ] Глобальная обработка ошибок
- [ ] Уведомления об успешных операциях

#### Titlebar (требует проверки)
- [x] Компонент создан
- [ ] Проверить работу кнопок minimize/maximize/close
- [ ] IPC handlers в main process

---

### ❌ Что не сделано

#### VSCode Extension (для MCP Manager)
- [ ] Базовая структура extension
- [ ] Подключение к MCP Manager host
- [ ] Отображение доступных серверов
- [ ] Отображение статуса серверов
- [ ] Auto-connect при открытии проекта

#### Тестирование
- [ ] Unit тесты
- [ ] Integration тесты
- [ ] E2E тесты

---

## API для VSCode Extension

### Подключение к Virtual Profile по пути

```typescript
// 1. Проверить существует ли VP (опционально)
const checkResponse = await fetch(
  `http://127.0.0.1:4040/api/workspaces/by-path?path=${encodeURIComponent(projectPath)}`
);
const { exists, workspace } = await checkResponse.json();

// 2. Подключиться (создаст VP если не существует)
const connectResponse = await fetch('http://127.0.0.1:4040/api/sessions/connect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectRoot: projectPath,        // Путь к проекту
    clientType: 'vscode',            // или 'cursor'
    clientInstanceId: vscodeWindowId // уникальный ID окна
  })
});

const { sessionId, workspaceId, mcpServers } = await connectResponse.json();
// mcpServers = { "server-id": "http://127.0.0.1:4040/mcp/server-id/workspace-id" }

// 3. Поддерживать сессию (каждые 30 сек)
setInterval(async () => {
  await fetch('http://127.0.0.1:4040/api/sessions/ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  });
}, 30000);

// 4. Отключиться при закрытии
await fetch('http://127.0.0.1:4040/api/sessions/disconnect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId })
});
```

### Получение информации о серверах

```typescript
// Список всех серверов
const servers = await fetch('http://127.0.0.1:4040/api/servers').then(r => r.json());

// Список workspaces
const workspaces = await fetch('http://127.0.0.1:4040/api/workspaces').then(r => r.json());

// WebSocket для real-time обновлений
const ws = new WebSocket('ws://127.0.0.1:4040/events');
ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  // type: 'server-started', 'server-stopped', 'workspace-created', etc.
};
```

---

## План на завтра

### Приоритет 1: VSCode Extension (Простая версия)

**Цель:** Минимальный extension который:
- Подключается к MCP Manager при старте
- Отображает список доступных серверов в TreeView
- Показывает статус серверов (running/stopped)
- Автоматически создает/находит VP для текущего проекта

**Задачи:**
1. Создать базовую структуру extension в `extension/` папке
2. Implement `activate()` - подключение к host
3. TreeView provider для отображения серверов
4. Status bar item с количеством running серверов
5. WebSocket listener для real-time обновлений

**НЕ делаем в простой версии:**
- Редактирование конфигурации серверов
- Создание/удаление серверов
- Управление секретами
- Запуск/остановка серверов из extension

### Приоритет 2: UI Fixes (если останется время)

1. **SecretsView редизайн**
   - Global/Workspace scope индикаторы
   - Edit/Delete кнопки
   - "Save & Restart" кнопка

2. **Toast уведомления**
   - Sonner или react-hot-toast
   - Интеграция с API ответами

---

## Структура простого VSCode Extension

```
extension/
├── package.json           # Extension manifest
├── src/
│   ├── extension.ts       # Entry point (activate/deactivate)
│   ├── McpManagerClient.ts # HTTP/WS клиент к host
│   ├── providers/
│   │   └── ServersTreeProvider.ts  # TreeView данные
│   └── views/
│       └── StatusBarItem.ts # Статус бар
└── tsconfig.json
```

### package.json (Extension manifest)

```json
{
  "name": "mcp-manager-extension",
  "displayName": "MCP Manager",
  "version": "0.1.0",
  "engines": { "vscode": "^1.85.0" },
  "activationEvents": ["onStartupFinished"],
  "main": "./dist/extension.js",
  "contributes": {
    "views": {
      "explorer": [{
        "id": "mcpServers",
        "name": "MCP Servers"
      }]
    }
  }
}
```

---

## Архитектура взаимодействия

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Manager (Electron)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              McpHost (localhost:4040)                 │  │
│  │  - HTTP API                                           │  │
│  │  - WebSocket /events                                  │  │
│  │  - MCP Gateway /mcp/:serverId/:workspaceId           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              │ HTTP + WebSocket
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                VSCode/Cursor Extension                       │
│  1. При старте: POST /api/sessions/connect                  │
│  2. Получает: sessionId + mcpServers endpoints              │
│  3. Слушает: WebSocket /events для обновлений               │
│  4. Отображает: TreeView с серверами                        │
│  5. При закрытии: POST /api/sessions/disconnect             │
└─────────────────────────────────────────────────────────────┘
```

---

## Заметки

### Virtual Profile (VP) Flow

1. **VSCode открывает проект** `/Users/dev/my-project`
2. **Extension активируется** и вызывает `/api/sessions/connect`
3. **Host проверяет** `findByProjectRoot('/Users/dev/my-project')`
4. **Если VP не найден** - создается новый с label = 'my-project'
5. **Host возвращает** workspaceId + список MCP серверов
6. **Extension отображает** серверы в TreeView

### Нормализация путей

`WorkspaceStore.normalizePath()` приводит пути к единому формату:
- `\` → `/`
- Lowercase

Это обеспечивает корректное сравнение путей на Windows/Mac/Linux.
