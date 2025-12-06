# MCP Manager

**Website**: [tscodex.com](https://tscodex.com)

Standalone desktop application for managing MCP (Model Context Protocol) servers. MCP Manager provides a centralized hub to configure, run, and monitor MCP servers across multiple projects with granular security controls and AI integration.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Servers](#servers)
  - [Workspaces](#workspaces)
  - [Sessions](#sessions)
- [Features](#features)
  - [Server Management](#server-management)
  - [Dynamic Tools (MCP Tools)](#dynamic-tools-mcp-tools)
  - [AI Assistant](#ai-assistant)
  - [Permissions System](#permissions-system)
  - [Secrets Management](#secrets-management)
- [IDE Integration](#ide-integration)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Development](#development)
- [License](#license)

---

## Installation

### Official Repository

- **GitHub Repository**: [https://github.com/unbywyd/tscodex-mcp-manager-app](https://github.com/unbywyd/tscodex-mcp-manager-app)
- **Releases**: [https://github.com/unbywyd/tscodex-mcp-manager-app/releases](https://github.com/unbywyd/tscodex-mcp-manager-app/releases)

Download the latest version for your platform:
- **Windows**: `.exe` installer
- **macOS**: `.dmg` disk image
- **Linux**: `.AppImage` or `.deb` package

### Auto-Updates

MCP Manager includes automatic update checking. When a new version is available, you'll be notified and can update with one click.

---

## Quick Start

1. **Install and launch** MCP Manager
2. **Add your first server**: Click "Add Server" and enter an npm package name (e.g., `@tscodex/mcp-images`)
3. **Create a workspace**: Link a project folder to organize server configurations
4. **Start the server**: Click the Play button to launch the server
5. **Connect from IDE**: Use the MCP Gateway URL in your IDE extension (Claude Desktop, Cursor, VS Code, etc.)

---

## Core Concepts

### Servers

A **Server** is an MCP-compliant package that provides tools, resources, and prompts to AI assistants. MCP Manager supports multiple installation methods:

| Type | Description | Use Case |
|------|-------------|----------|
| **npm** | Installed to local app directory | Recommended - fast startup, version locked |
| **npx** | Run via `npx` each time | Testing packages, one-off usage |
| **pnpx** | Run via `pnpm dlx` | PNPM users |
| **yarn** | Run via `yarn dlx` | Yarn users |
| **bunx** | Run via `bunx` | Bun users |
| **local** | Local file path | Development, custom scripts |

#### Server Lifecycle

```
┌──────────┐    Start     ┌──────────┐    Stop      ┌──────────┐
│ Stopped  │ ──────────▶  │ Running  │ ──────────▶  │ Stopped  │
└──────────┘              └──────────┘              └──────────┘
     ▲                         │
     │                         │ Error
     │         Restart         ▼
     └───────────────────  ┌──────────┐
                           │  Error   │
                           └──────────┘
```

### Workspaces

A **Workspace** represents a project directory. Each workspace can have its own:
- Server configurations (enabled/disabled servers, custom settings)
- Environment variable overrides
- Permission overrides
- Context information (project root path)

**Global Workspace**: A special workspace where you configure server defaults. Settings here apply to all workspaces unless overridden.

### Sessions

A **Session** is an active connection from an IDE extension (Claude Desktop, Cursor, etc.) to MCP Manager. Sessions:
- Have unique IDs for tracking
- Provide context about the connected client
- Enable per-request workspace isolation
- Support connection keepalive via ping

---

## Features

### Server Management

#### Adding Servers

1. Click **"Add Server"** in the sidebar
2. Choose installation type:
   - **NPM Package** (recommended): Enter package name like `@tscodex/mcp-images`
   - **Local Path**: Browse to a local MCP server script
   - **NPX/PNPX/Yarn/Bunx**: For package runner execution
3. MCP Manager verifies the server and displays available tools/resources/prompts
4. Click **"Add Server"** to complete

#### Server Detail Page

Each server has a detail page with tabs:

| Tab | Description |
|-----|-------------|
| **Overview** | Server info, tools, resources, prompts, connection URL |
| **Config** | Server-specific configuration (if supported) |
| **Secrets** | Manage API keys and tokens for this server |
| **Permissions** | Control environment access, AI access, and more |

#### Starting/Stopping Servers

- **Start**: Click the Play button (▶) on a server card or detail page
- **Stop**: Click the Stop button (■)
- **Restart**: Click the Restart button (↻)

Servers are started per workspace-server combination. The same server can run multiple times for different workspaces.

#### Connection URL

Each running server instance has a unique MCP Gateway URL:
```
http://127.0.0.1:4040/mcp/{serverId}/{workspaceId}
```

Copy this URL to your IDE extension configuration.

### Dynamic Tools (MCP Tools)

MCP Manager includes a built-in **MCP Tools server** that lets you create custom tools, prompts, and resources without writing a separate package.

#### Accessing MCP Tools

1. Click **"MCP Tools"** in the sidebar
2. Enable the server with the toggle
3. Create tools, prompts, or resources

#### Tool Types

**Tools** - Executable functions that AI can call:

| Executor Type | Description | Use Case |
|---------------|-------------|----------|
| **Static** | Returns fixed content | Constants, templates, documentation |
| **HTTP** | Makes HTTP requests | API integrations, webhooks |
| **Function** | Runs JavaScript code | Data processing, complex logic |

**Example Static Tool:**
```json
{
  "name": "company_info",
  "description": "Returns company information",
  "executor": {
    "type": "static",
    "content": "Company: Acme Corp\nFounded: 2020",
    "contentType": "text"
  }
}
```

**Example HTTP Tool:**
```json
{
  "name": "get_weather",
  "description": "Get weather for a city",
  "inputSchema": {
    "type": "object",
    "properties": {
      "city": { "type": "string" }
    },
    "required": ["city"]
  },
  "executor": {
    "type": "http",
    "method": "GET",
    "url": "https://api.weather.com/v1/weather?city={{city}}&key={{SECRET_WEATHER_KEY}}"
  }
}
```

**Example Function Tool:**
```javascript
// Executor type: function
async (params, context) => {
  const { text } = params;
  const wordCount = text.split(/\s+/).length;
  return { wordCount, charCount: text.length };
}
```

#### Available Context in Function Executors

```javascript
async (params, context) => {
  // Input parameters
  const { param1, param2 } = params;

  // Session context
  context.session.workspaceId;   // Current workspace ID
  context.session.projectRoot;   // Project directory path
  context.session.clientType;    // e.g., "claude-code", "cursor"

  // Request context
  context.request.timestamp;     // Unix timestamp (ms)
  context.request.requestId;     // Unique request ID

  // Utilities
  await context.utils.fetch(url, options);  // HTTP fetch
  context.utils.log(message);               // Logging

  return { result: "..." };
}
```

#### Resources

Resources provide read-only content to AI:

```json
{
  "name": "project_guidelines",
  "description": "Project coding guidelines",
  "mimeType": "text/markdown",
  "executor": {
    "type": "static",
    "content": "# Guidelines\n\n- Use TypeScript\n- Write tests..."
  }
}
```

#### Prompts

Prompts are reusable message templates:

```json
{
  "name": "code_review",
  "description": "Template for code review",
  "arguments": [
    { "name": "code", "description": "Code to review", "required": true }
  ],
  "messages": [
    {
      "role": "user",
      "content": "Please review this code:\n\n{{code}}"
    }
  ]
}
```

#### AI-Assisted Generation

Click the **✨ AI** button when creating tools/resources to generate definitions from natural language descriptions. Requires AI Assistant to be configured.

### AI Assistant

The AI Assistant provides an OpenAI-compatible proxy that MCP servers can use for AI capabilities.

#### Configuration

1. Go to **Settings > AI Assistant**
2. Enter your OpenAI-compatible API credentials:
   - **Base URL**: API endpoint (e.g., `https://api.openai.com/v1`)
   - **API Key**: Your API key
   - **Default Model**: Model to use (e.g., `gpt-4o-mini`)
3. Click **Verify & Save**

#### How It Works

When an MCP server has AI access enabled, MCP Manager:
1. Injects `MCP_AI_PROXY_URL` and `MCP_AI_PROXY_TOKEN` environment variables
2. Server uses these to make AI requests through MCP Manager's proxy
3. MCP Manager forwards requests to the configured AI provider
4. Your actual API key is never exposed to the server

#### Enabling AI Access for Servers

1. Open server detail page
2. Go to **Permissions** tab
3. In the **AI Access** section, toggle **"Allow AI Access"**
4. Optionally configure:
   - **Allowed Models**: Restrict which models the server can use
   - **Rate Limit**: Max requests per minute (0 = unlimited)

#### Global Access Token

For external tools or testing, you can generate a global access token:

1. Go to **Settings > AI Assistant > Global Access**
2. Click **Copy Token** to get the token
3. Use with the proxy URL: `http://127.0.0.1:4040/api/ai/proxy/v1`

```bash
curl http://127.0.0.1:4040/api/ai/proxy/v1/chat/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "Hello!"}]}'
```

#### Usage Statistics

View AI usage stats in **Settings > AI Assistant > Usage Stats**:
- Total requests and tokens
- Per-server breakdown
- Request history log

### Permissions System

MCP Manager provides granular control over what each server can access.

#### Permission Categories

| Category | Controls |
|----------|----------|
| **Environment** | System environment variables passed to server |
| **Context** | Workspace/session information |
| **Secrets** | Which secret keys from Secret Store |
| **AI Access** | AI Assistant proxy access |

#### Environment Permissions

| Permission | Variables | Default |
|------------|-----------|---------|
| **Allow PATH** | `PATH`, `PATHEXT` | ✅ |
| **Allow Home** | `HOME`, `USERPROFILE`, `HOMEPATH` | ✅ |
| **Allow Lang** | `LANG`, `LANGUAGE`, `LC_*` | ✅ |
| **Allow Temp** | `TEMP`, `TMP`, `TMPDIR` | ✅ |
| **Allow Node** | `NODE_*`, `npm_*` | ✅ |
| **Custom Allowlist** | Specific variable names | Empty |

#### Context Permissions

| Permission | Variable | Description |
|------------|----------|-------------|
| **Allow Project Root** | `MCP_PROJECT_ROOT` | Workspace directory path |
| **Allow Workspace ID** | `MCP_WORKSPACE_ID` | Workspace identifier |
| **Allow User Profile** | `MCP_AUTH_TOKEN` | User info (if authenticated) |

#### Secrets Permissions

| Mode | Description |
|------|-------------|
| **None** | No secrets passed |
| **Allowlist** | Only specified secret keys |
| **All** | All secrets in the store |

#### Global vs Workspace Permissions

- **Global Permissions**: Configured on the server, apply everywhere
- **Workspace Override**: Override global settings for specific workspace

### Secrets Management

Secrets are stored securely in your OS keychain:
- **Windows**: Windows Credential Store
- **macOS**: Keychain
- **Linux**: GNOME Keyring / KDE Wallet

#### Adding Secrets

1. Open server detail page > **Secrets** tab
2. Click **Add Secret**
3. Enter key name and value
4. Click **Save**

#### Using Secrets

Secrets are passed as environment variables to servers:
- Secret key: `MY_API_KEY`
- Environment variable: `MY_API_KEY=<value>`

In Dynamic Tools HTTP executor, use `{{SECRET_KEY_NAME}}` placeholders.

---

## IDE Integration

MCP Manager works with any MCP-compatible IDE extension:

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "my-server": {
      "command": "curl",
      "args": ["-X", "POST", "http://127.0.0.1:4040/mcp/SERVER_ID/WORKSPACE_ID"]
    }
  }
}
```

### Cursor / VS Code

**VS Code Extension**: [MCP Manager Bridge](https://github.com/unbywyd/tscodex-msp-manager-bridge) - Official VS Code/Cursor extension that provides a bridge to MCP Manager, allowing you to view and control MCP servers directly from your IDE.

Use the MCP extension and configure the gateway URL:
```
http://127.0.0.1:4040/mcp/{serverId}/{workspaceId}
```

### Session Connection

For IDE extensions that support session management:

```bash
# Connect session
POST /api/sessions/connect
{
  "clientId": "unique-client-id",
  "clientType": "cursor",
  "workspaceId": "workspace-id"
}

# Keep session alive
POST /api/sessions/ping
{
  "sessionId": "returned-session-id"
}

# Disconnect
POST /api/sessions/disconnect
{
  "sessionId": "session-id"
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Manager App                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   Electron Shell                        │  │
│  │  • System tray integration                              │  │
│  │  • Window management                                    │  │
│  │  • Auto-start on login                                  │  │
│  │  • Auto-updates                                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                            │                                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                     MCP Host                            │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐  │  │
│  │  │  HTTP API    │ │ MCP Gateway  │ │ Process Manager│  │  │
│  │  │  (REST)      │ │ (Proxy)      │ │ (Spawn/Kill)   │  │  │
│  │  └──────────────┘ └──────────────┘ └────────────────┘  │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐  │  │
│  │  │  WebSocket   │ │  AI Proxy    │ │  MCP Tools     │  │  │
│  │  │  (Events)    │ │  (OpenAI)    │ │  (Dynamic)     │  │  │
│  │  └──────────────┘ └──────────────┘ └────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                            │                                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                     React UI                            │  │
│  │  • Server management    • Workspace configuration       │  │
│  │  • Secrets management   • Dynamic tools editor          │  │
│  │  • AI Assistant config  • Permissions editor            │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
IDE Extension ──▶ MCP Gateway ──▶ Process Manager ──▶ MCP Server
     │                │                                    │
     │                ▼                                    │
     │         Route to correct                            │
     │         server instance                             │
     │                                                     │
     ◀───────────── Response ◀─────────────────────────────┘
```

### Configuration Storage

```
Windows:  %APPDATA%/mcp-manager/
macOS:    ~/Library/Application Support/mcp-manager/
Linux:    ~/.config/mcp-manager/

Structure:
├── config/
│   ├── servers.json      # Server templates
│   ├── workspaces.json   # Workspace configs
│   ├── mcp-tools.json    # Dynamic tools
│   └── ai-usage.json     # AI usage stats
└── logs/
    └── main.log
```

---

## API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/servers` | List all servers |
| POST | `/api/servers` | Add new server |
| PATCH | `/api/servers/:id` | Update server |
| DELETE | `/api/servers/:id` | Delete server |
| GET | `/api/workspaces` | List workspaces |
| POST | `/api/workspaces` | Create workspace |
| PATCH | `/api/workspaces/:id` | Update workspace |
| DELETE | `/api/workspaces/:id` | Delete workspace |

### Instance Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/instances` | List running instances |
| POST | `/api/instances/start` | Start server instance |
| POST | `/api/instances/stop` | Stop server instance |
| POST | `/api/instances/restart` | Restart server instance |

### MCP Gateway

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mcp/:serverId/:workspaceId/*` | Proxy MCP requests |

### AI Proxy

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai/proxy/v1/models` | List available models |
| POST | `/api/ai/proxy/v1/chat/completions` | Chat completion |

### WebSocket

Connect to `/events` for real-time updates:
- `server:started`
- `server:stopped`
- `server:error`
- `instance:updated`

---

## Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Setup

```bash
# Clone repository
git clone https://github.com/unbywyd/tscodex-mcp-manager-app.git
cd tscodex-mcp-manager-app

# Install dependencies
npm install

# Start development server
npm run dev

# In another terminal, start Electron
npm start
```

### Build

```bash
# Build for production
npm run build

# Package for distribution
npm run dist:win    # Windows
npm run dist:mac    # macOS
npm run dist:linux  # Linux
```

### Project Structure

```
src/
├── main/           # Electron main process
├── host/           # MCP Host (HTTP server, process manager)
│   ├── api/        # REST API routes
│   ├── ai/         # AI Agent
│   ├── mcp-tools/  # Dynamic tools runtime
│   ├── managers/   # Process, session managers
│   └── stores/     # Data stores
├── renderer/       # React UI
│   ├── components/ # UI components
│   ├── stores/     # Zustand stores
│   └── lib/        # Utilities
└── shared/         # Shared types
```

---

## Example MCP Servers

### Recommended Packages

- **[@tscodex/mcp-images](https://www.npmjs.com/package/@tscodex/mcp-images)** - Image processing, stock search, AI generation
- **[@tscodex/mcp-server-example](https://www.npmjs.com/package/@tscodex/mcp-server-example)** - SDK examples and best practices

---

## Platform Notes

### Windows
- Uses Windows Credential Store for secrets
- No additional setup required

### macOS
- Uses Keychain for secrets
- Requires code signing for distribution

### Linux
- Requires `libsecret-1-dev` and GNOME Keyring or KDE Wallet
- Install: `sudo apt install libsecret-1-dev gnome-keyring`

---

## Security

- **Secrets**: Stored in OS keychain (never in plain text)
- **HTTP API**: Localhost only (127.0.0.1)
- **AI Keys**: Proxied without exposure to servers
- **Permissions**: Granular control over server access
- **IPC**: Secure communication between UI and host

---

## License

This project is licensed under the [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) license.

- Free for non-commercial use
- Attribution required
- Commercial use requires separate license

For commercial licensing, contact the author.
