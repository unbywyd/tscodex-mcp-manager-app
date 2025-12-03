# MCP Manager Bridge - VSCode Extension

## Обзор

**MCP Manager Bridge** — легковесное VSCode расширение для интеграции с MCP Manager. Расширение выступает "мостом" между IDE и основным приложением, не дублируя его функционал.

### Философия

- **Минимализм**: Только preview и базовые действия
- **Надежность**: Graceful degradation при потере связи
- **Скорость**: Мгновенный отклик, фоновая синхронизация
- **Простота**: Понятный UX без перегрузки

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Manager (Electron App)                │
│                    localhost:PORT (user-defined)             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  HTTP API + WebSocket /events                          │ │
│  │  - POST /api/sessions/connect                          │ │
│  │  - GET /api/servers                                    │ │
│  │  - GET /api/instances                                  │ │
│  │  - POST /api/instances/start|stop                      │ │
│  │  - WS real-time events                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              │ HTTP + WebSocket
                              ↓
┌─────────────────────────────────────────────────────────────┐
│               MCP Manager Bridge (VSCode Extension)          │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │   TreeView        │  │   Status Bar                     │ │
│  │   (Sidebar)       │  │   "MCP: 3/5 running"            │ │
│  │                   │  └──────────────────────────────────┘ │
│  │  ○ filesystem     │                                      │
│  │    ├ running      │  ┌──────────────────────────────────┐ │
│  │    └ :4101        │  │   Quick Actions                  │ │
│  │                   │  │   - Toggle server on/off         │ │
│  │  ● github         │  │   - Open MCP Manager             │ │
│  │    ├ stopped      │  │   - Refresh                      │ │
│  │    └ —            │  └──────────────────────────────────┘ │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Конфигурация порта

### Проблема
MCP Manager использует порт `4040` по умолчанию, но он может быть занят или пользователь может выбрать другой порт.

### Решение
При первом запуске расширение просит ввести порт API:

```
┌─────────────────────────────────────────────────────────────┐
│  MCP Manager Bridge - Configuration                         │
│                                                              │
│  Enter MCP Manager API port:                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 4040                                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Default: 4040                                              │
│  Tip: Check MCP Manager settings for the correct port       │
│                                                              │
│  [Cancel]                                    [Connect]      │
└─────────────────────────────────────────────────────────────┘
```

### Конфигурация (settings.json)
```json
{
  "mcpBridge.port": 4040,
  "mcpBridge.autoConnect": true,
  "mcpBridge.reconnectInterval": 5000,
  "mcpBridge.heartbeatInterval": 30000
}
```

---

## Компоненты расширения

### 1. Status Bar Item

Всегда видимый индикатор в нижней панели:

```
┌───────────────────────────────────────────────────────────────┐
│ ... │ MCP: 3/5 ● │ ... │                                      │
└───────────────────────────────────────────────────────────────┘
      │            │
      │            └── Зеленая точка = connected
      │                Красная точка = disconnected
      │                Желтая точка = reconnecting
      │
      └── Клик открывает command palette с командами
```

**Состояния:**
- `MCP: 3/5 ●` — 3 из 5 серверов running, connected
- `MCP: — ○` — disconnected, серая точка
- `MCP: ... ◐` — connecting/reconnecting, анимация

### 2. TreeView (Sidebar)

В Explorer появляется секция **MCP Servers**:

```
MCP SERVERS
├─ 🟢 filesystem
│    Status: running
│    Port: 4101
│    [Stop] [Restart]
│
├─ 🔴 github
│    Status: stopped
│    [Start]
│
├─ 🟡 database
│    Status: starting...
│
└─ 🔴 openai
     Status: error
     Last error: API key invalid
     [Start] [View Logs]
```

**Иконки статусов:**
- 🟢 `running` — сервер работает
- 🔴 `stopped` — остановлен
- 🟡 `starting` — запускается
- ⚠️ `error` — ошибка

**Контекстное меню (правый клик):**
- Start Server
- Stop Server
- Restart Server
- View in MCP Manager (открывает app)
- Copy MCP Endpoint URL

### 3. Commands (Command Palette)

```
> MCP Bridge: Connect to MCP Manager
> MCP Bridge: Disconnect
> MCP Bridge: Configure Port
> MCP Bridge: Refresh Servers
> MCP Bridge: Start All Servers
> MCP Bridge: Stop All Servers
> MCP Bridge: Open MCP Manager App
> MCP Bridge: Show Server Logs
```

---

## Connection Flow

### Startup Sequence

```
┌────────────────────────────────────────────────────────────┐
│                     Extension Activation                    │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│  1. Check config: mcpBridge.port                           │
│     - If not set → prompt user                             │
│     - If set → continue                                    │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│  2. Health Check: GET http://127.0.0.1:{port}/api/health   │
│     - Success → continue                                   │
│     - Fail → show "MCP Manager not running" status         │
│            → schedule retry every 5 seconds                │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│  3. Register Session:                                      │
│     POST /api/sessions/connect                             │
│     {                                                      │
│       projectRoot: workspace.uri.fsPath,                   │
│       clientType: "vscode",                                │
│       clientInstanceId: vscode.env.sessionId,              │
│       sourceLabel: "VS Code"                               │
│     }                                                      │
│     → Receive: { sessionId, workspaceId, mcpServers }      │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│  4. Fetch Initial Data:                                    │
│     - GET /api/servers → list of server templates          │
│     - GET /api/instances → running instances + status      │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│  5. Connect WebSocket: ws://127.0.0.1:{port}/events        │
│     - Listen for real-time updates                         │
│     - Update TreeView on events                            │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│  6. Start Heartbeat: POST /api/sessions/ping               │
│     - Every 30 seconds                                     │
│     - Keeps session alive                                  │
└────────────────────────────────────────────────────────────┘
```

### Reconnection Logic

```typescript
class ConnectionManager {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseDelay = 1000; // 1 second
  private maxDelay = 30000; // 30 seconds

  async reconnect(): Promise<void> {
    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(
        this.baseDelay * Math.pow(2, this.reconnectAttempts),
        this.maxDelay
      );

      this.updateStatus('reconnecting', `Retry in ${delay/1000}s...`);
      await this.sleep(delay);

      try {
        await this.connect();
        this.reconnectAttempts = 0;
        return;
      } catch (error) {
        this.reconnectAttempts++;
      }
    }

    this.updateStatus('disconnected', 'MCP Manager unavailable');
    this.showNotification(
      'Could not connect to MCP Manager. Is it running?',
      'Retry',
      () => this.reconnect()
    );
  }
}
```

---

## WebSocket Events

### События которые слушает расширение

```typescript
interface ServerEvent {
  type: 'server-starting' | 'server-started' | 'server-stopped' | 'server-error' | 'server-log';
  serverId: string;
  workspaceId: string;
  timestamp: number;
  data: {
    port?: number;
    error?: string;
    message?: string;
    level?: 'info' | 'warn' | 'error' | 'debug';
  };
}

interface AppEvent {
  type: 'workspace-created' | 'workspace-updated' | 'workspace-deleted' |
        'session-connected' | 'session-disconnected' | 'profile-updated';
  timestamp: number;
  data: Record<string, unknown>;
}
```

### Обработка событий

```typescript
websocket.on('message', (data) => {
  const event = JSON.parse(data);

  switch (event.type) {
    case 'server-started':
      // Update TreeView item to show running + port
      this.treeProvider.updateServer(event.serverId, {
        status: 'running',
        port: event.data.port
      });
      // Update status bar counter
      this.statusBar.incrementRunning();
      break;

    case 'server-stopped':
      this.treeProvider.updateServer(event.serverId, {
        status: 'stopped',
        port: null
      });
      this.statusBar.decrementRunning();
      break;

    case 'server-error':
      this.treeProvider.updateServer(event.serverId, {
        status: 'error',
        error: event.data.error
      });
      // Show notification for errors
      vscode.window.showErrorMessage(
        `MCP Server "${event.serverId}" error: ${event.data.error}`
      );
      break;

    case 'server-starting':
      this.treeProvider.updateServer(event.serverId, {
        status: 'starting'
      });
      break;
  }
});
```

---

## API Calls

### Минимальный набор API для расширения

| Endpoint | Метод | Назначение |
|----------|-------|------------|
| `/api/health` | GET | Health check перед подключением |
| `/api/sessions/connect` | POST | Регистрация сессии |
| `/api/sessions/ping` | POST | Heartbeat |
| `/api/sessions/disconnect` | POST | Отключение при деактивации |
| `/api/servers` | GET | Список шаблонов серверов |
| `/api/instances` | GET | Список запущенных инстансов |
| `/api/instances/start` | POST | Запуск сервера |
| `/api/instances/stop` | POST | Остановка сервера |

### Пример вызовов

```typescript
class McpBridgeClient {
  constructor(private baseUrl: string) {}

  async connect(projectRoot: string): Promise<SessionResponse> {
    const response = await fetch(`${this.baseUrl}/api/sessions/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectRoot,
        clientType: 'vscode',
        clientInstanceId: vscode.env.sessionId,
        sourceLabel: 'VS Code'
      })
    });
    return response.json();
  }

  async getServers(): Promise<Server[]> {
    const response = await fetch(`${this.baseUrl}/api/servers`);
    return response.json();
  }

  async getInstances(): Promise<Instance[]> {
    const response = await fetch(`${this.baseUrl}/api/instances`);
    return response.json();
  }

  async startServer(serverId: string, workspaceId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/instances/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId, workspaceId })
    });
  }

  async stopServer(serverId: string, workspaceId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/instances/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId, workspaceId })
    });
  }
}
```

---

## UX Flow

### Сценарий 1: Первый запуск

```
1. Пользователь открывает VSCode с установленным расширением
2. Status Bar показывает: "MCP: — ○" (disconnected)
3. Появляется notification:
   "MCP Manager Bridge: Enter API port to connect"
   [Configure] [Later]
4. Пользователь кликает Configure
5. Input box: "Enter MCP Manager port (default: 4040)"
6. После ввода порта расширение пытается подключиться
7. Если успех: Status Bar → "MCP: 0/3 ●"
8. TreeView обновляется списком серверов
```

### Сценарий 2: MCP Manager не запущен

```
1. Расширение пытается подключиться
2. Health check fails
3. Status Bar: "MCP: — ○"
4. Notification: "MCP Manager is not running. Start it to manage MCP servers."
   [Open MCP Manager] [Dismiss]
5. Фоновые попытки переподключения каждые 5 секунд
6. Когда MCP Manager запускается → автоподключение
7. Notification: "Connected to MCP Manager"
```

### Сценарий 3: Вкл/выкл сервера

```
1. Пользователь видит в TreeView сервер "github" (stopped)
2. Клик правой кнопкой → "Start Server"
3. TreeView показывает "github" с иконкой 🟡 "starting..."
4. WebSocket получает server-started event
5. TreeView обновляется: 🟢 "github" + "Port: 4102"
6. Status Bar: "MCP: 2/3 ●" → "MCP: 3/3 ●"
```

### Сценарий 4: Потеря соединения

```
1. MCP Manager падает/закрывается
2. WebSocket disconnects
3. Status Bar: "MCP: 3/3 ●" → "MCP: ... ◐" (reconnecting)
4. TreeView items становятся серыми (stale data)
5. Exponential backoff reconnection attempts
6. После 10 неудачных попыток:
   Status Bar: "MCP: — ○"
   Notification: "Lost connection to MCP Manager"
   TreeView показывает "Disconnected" в header
```

---

## Структура файлов расширения

```
extension/
├── package.json           # Extension manifest
├── tsconfig.json
├── src/
│   ├── extension.ts       # Entry point, activation/deactivation
│   ├── client/
│   │   ├── McpBridgeClient.ts    # HTTP API client
│   │   └── WebSocketClient.ts    # WebSocket connection
│   ├── connection/
│   │   └── ConnectionManager.ts  # Connection lifecycle, reconnection
│   ├── providers/
│   │   ├── ServerTreeProvider.ts # TreeView data provider
│   │   └── StatusBarProvider.ts  # Status bar management
│   ├── commands/
│   │   └── index.ts              # All registered commands
│   └── types/
│       └── index.ts              # TypeScript interfaces
└── resources/
    └── icons/
        ├── server-running.svg
        ├── server-stopped.svg
        ├── server-error.svg
        └── server-starting.svg
```

---

## Package.json (ключевые части)

```json
{
  "name": "mcp-manager-bridge",
  "displayName": "MCP Manager Bridge",
  "description": "Bridge extension for MCP Manager - view and control MCP servers",
  "version": "0.1.0",
  "publisher": "unbywyd",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onStartupFinished"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "mcp-bridge",
          "title": "MCP Servers",
          "icon": "resources/icons/mcp-logo.svg"
        }
      ]
    },
    "views": {
      "mcp-bridge": [
        {
          "id": "mcpServers",
          "name": "Servers",
          "contextualTitle": "MCP Servers"
        }
      ]
    },
    "commands": [
      {
        "command": "mcpBridge.connect",
        "title": "MCP Bridge: Connect to MCP Manager"
      },
      {
        "command": "mcpBridge.disconnect",
        "title": "MCP Bridge: Disconnect"
      },
      {
        "command": "mcpBridge.configurePort",
        "title": "MCP Bridge: Configure Port"
      },
      {
        "command": "mcpBridge.refresh",
        "title": "MCP Bridge: Refresh Servers"
      },
      {
        "command": "mcpBridge.startServer",
        "title": "Start Server"
      },
      {
        "command": "mcpBridge.stopServer",
        "title": "Stop Server"
      },
      {
        "command": "mcpBridge.restartServer",
        "title": "Restart Server"
      },
      {
        "command": "mcpBridge.openManager",
        "title": "MCP Bridge: Open MCP Manager App"
      }
    ],
    "menus": {
      "view/item/context": [
        {
          "command": "mcpBridge.startServer",
          "when": "view == mcpServers && viewItem == server-stopped",
          "group": "1_actions"
        },
        {
          "command": "mcpBridge.stopServer",
          "when": "view == mcpServers && viewItem == server-running",
          "group": "1_actions"
        },
        {
          "command": "mcpBridge.restartServer",
          "when": "view == mcpServers && viewItem == server-running",
          "group": "1_actions"
        }
      ]
    },
    "configuration": {
      "title": "MCP Manager Bridge",
      "properties": {
        "mcpBridge.port": {
          "type": "number",
          "default": 4040,
          "description": "Port of the MCP Manager API server"
        },
        "mcpBridge.autoConnect": {
          "type": "boolean",
          "default": true,
          "description": "Automatically connect to MCP Manager on startup"
        },
        "mcpBridge.reconnectInterval": {
          "type": "number",
          "default": 5000,
          "description": "Interval between reconnection attempts (ms)"
        },
        "mcpBridge.heartbeatInterval": {
          "type": "number",
          "default": 30000,
          "description": "Interval between heartbeat pings (ms)"
        }
      }
    }
  }
}
```

---

## Что НЕ делает расширение

Чтобы не дублировать функционал MCP Manager:

- ❌ Не управляет конфигурацией серверов
- ❌ Не редактирует аргументы/переменные окружения
- ❌ Не управляет секретами
- ❌ Не создает/удаляет серверы
- ❌ Не управляет workspaces
- ❌ Не показывает логи (только ссылка "Open MCP Manager")

Для этих задач пользователь открывает MCP Manager App.

---

## Итого

**MCP Manager Bridge** — простое расширение с четким фокусом:

1. **Подключение** к MCP Manager с настраиваемым портом
2. **Отображение** списка серверов и их статусов
3. **Управление** start/stop/restart одним кликом
4. **Синхронизация** через WebSocket в реальном времени
5. **Надежность** через reconnection логику

Все остальное — в основном приложении MCP Manager.
