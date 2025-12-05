# MCP Manager

Standalone desktop application for managing MCP (Model Context Protocol) servers.

## Features

- **Centralized Process Management**: Single application manages all MCP server processes
- **Workspace Isolation**: Configure servers per project/workspace
- **Secure Secrets**: OS keychain storage for API keys and tokens
- **MCP Gateway**: Proxy requests to servers with workspace context
- **Real-time Updates**: WebSocket events for status changes
- **Dynamic Tools**: Create custom tools, prompts, and resources with JavaScript
- **AI Assistant**: Built-in AI proxy for MCP servers (OpenAI-compatible)
- **Cross-platform**: Windows, macOS, and Linux support

## Architecture

```
┌─────────────────────────────────────────┐
│           MCP Manager App               │
│  ┌───────────────────────────────────┐  │
│  │         Electron Shell            │  │
│  │  - System tray                    │  │
│  │  - Window management              │  │
│  │  - Auto-start                     │  │
│  └───────────────────────────────────┘  │
│                   │                     │
│  ┌───────────────────────────────────┐  │
│  │          MCP Host                 │  │
│  │  - HTTP API (dynamic port)        │  │
│  │  - MCP Gateway proxy              │  │
│  │  - Process Manager                │  │
│  │  - WebSocket events               │  │
│  │  - AI Proxy (OpenAI-compatible)   │  │
│  └───────────────────────────────────┘  │
│                   │                     │
│  ┌───────────────────────────────────┐  │
│  │          React UI                 │  │
│  │  - Server management              │  │
│  │  - Workspace configuration        │  │
│  │  - Secrets management             │  │
│  │  - Dynamic tools editor           │  │
│  │  - AI Assistant configuration     │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Setup

```bash
# Install dependencies
npm install

# Start development
npm run dev

# In another terminal, start Electron
npm start
```

### Build

```bash
# Build for production
npm run build

# Package for distribution
npm run dist
```

## API Endpoints

### Health Check
```
GET /api/health
```

### Authentication
```
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/profile
```

### Servers
```
GET    /api/servers
POST   /api/servers
PATCH  /api/servers/:id
DELETE /api/servers/:id
```

### Workspaces
```
GET    /api/workspaces
POST   /api/workspaces
PATCH  /api/workspaces/:id
DELETE /api/workspaces/:id
```

### Instances
```
GET  /api/instances
POST /api/instances/start
POST /api/instances/stop
POST /api/instances/restart
```

### Sessions (for IDE extensions)
```
POST /api/sessions/connect
POST /api/sessions/ping
POST /api/sessions/disconnect
```

### MCP Gateway
```
POST /mcp/:serverId/:workspaceId/*
```

### AI Assistant
```
GET  /api/ai/status
GET  /api/ai/config
POST /api/ai/verify
POST /api/ai/generate/tool
POST /api/ai/generate/resource
```

### Dynamic Tools
```
GET    /api/mcp-tools/status
GET    /api/mcp-tools/tools
POST   /api/mcp-tools/tools
PUT    /api/mcp-tools/tools/:id
DELETE /api/mcp-tools/tools/:id
```

### WebSocket Events
```
WS /events
```

## Supported Package Runners

| Type | Command |
|------|---------|
| npx | `npx package@version` |
| pnpx | `pnpm dlx package@version` |
| yarn | `yarn dlx package@version` |
| bunx | `bunx package@version` |
| local | `node /path/to/file` |

## Configuration Storage

```
Windows:  %APPDATA%/mcp-manager/
macOS:    ~/Library/Application Support/mcp-manager/
Linux:    ~/.config/mcp-manager/

Structure:
├── config/
│   ├── servers.json
│   └── workspaces.json
└── logs/
```

## Security

- Secrets stored in OS keychain (keytar)
- HTTP API only on localhost (127.0.0.1)
- Secret values never exposed via HTTP API
- Secure IPC for secret access from UI
- AI API keys stored securely, proxied without exposure

## Platform Notes

### macOS
- Secrets stored in Keychain
- Requires code signing for distribution

### Linux
- Requires `libsecret-1-dev` and GNOME Keyring or KDE Wallet for secure storage
- Install: `sudo apt install libsecret-1-dev gnome-keyring`

### Windows
- Uses Windows Credential Store
- No additional setup required

## License

MIT
