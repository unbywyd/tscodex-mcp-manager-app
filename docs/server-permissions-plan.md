# Server Permissions Allowlist - Implementation Plan

## Overview

This feature introduces a security layer that controls what environment variables, workspace context, and secrets are passed to MCP servers. The goal is to prevent potential data leakage from malicious or compromised servers.

## Problem Statement

Currently, `ProcessManager.buildEnvironment()` passes:
1. **ALL system environment variables** via `...process.env` - exposes PATH, HOME, user data, etc.
2. **ALL secrets** from app global + server global + server workspace scopes
3. **Workspace context data** (project root, workspace ID, user profile)

A malicious server could extract sensitive information from the environment.

## Solution: Allowlist-Based Permissions

Each server will have a **Permissions** configuration that explicitly controls what data it can access. Permissions work at two levels:
- **Global level** - Default permissions for all workspaces
- **Workspace level** - Can override global permissions per workspace

### Permission Categories

#### A. System Environment Variables (`envAllowlist`)
Controls which parent process environment variables are passed to the server.

```typescript
interface EnvPermissions {
  // Predefined categories
  allowPath: boolean;        // PATH, PATHEXT
  allowHome: boolean;        // HOME, USERPROFILE, HOMEPATH
  allowLang: boolean;        // LANG, LANGUAGE, LC_*
  allowTemp: boolean;        // TEMP, TMP, TMPDIR
  allowNode: boolean;        // NODE_*, npm_*

  // Custom allowlist for specific variables
  customAllowlist: string[]; // e.g., ["MY_API_ENDPOINT", "DEBUG"]
}
```

#### B. Workspace Context (`contextPermissions`)
Controls what workspace/session data is exposed.

```typescript
interface ContextPermissions {
  allowProjectRoot: boolean;     // MCP_PROJECT_ROOT
  allowWorkspaceId: boolean;     // MCP_WORKSPACE_ID
  allowUserProfile: boolean;     // User email/name in MCP_AUTH_TOKEN
}
```

#### C. Secrets Allowlist (`secretsAllowlist`)
Controls which secrets from the Secret Store can be passed.

```typescript
interface SecretsPermissions {
  // Mode: 'none' | 'allowlist' | 'all'
  mode: 'none' | 'allowlist' | 'all';

  // When mode is 'allowlist', only these keys are passed
  allowlist: string[]; // e.g., ["SECRET_OPENAI_API_KEY", "SECRET_GITHUB_TOKEN"]
}
```

### Complete Permission Interface

```typescript
interface ServerPermissions {
  // System ENV variables
  env: EnvPermissions;

  // Workspace context
  context: ContextPermissions;

  // Secrets
  secrets: SecretsPermissions;
}

// Default permissions (secure by default)
const DEFAULT_PERMISSIONS: ServerPermissions = {
  env: {
    allowPath: true,
    allowHome: false,
    allowLang: true,
    allowTemp: true,
    allowNode: true,
    customAllowlist: [],
  },
  context: {
    allowProjectRoot: true,
    allowWorkspaceId: true,
    allowUserProfile: true,
  },
  secrets: {
    mode: 'none',
    allowlist: [],
  },
};
```

## Architecture Changes

### 1. New Types (`src/shared/types.ts`)

Add new types for permissions:

```typescript
// Permission types
export interface EnvPermissions {
  allowPath: boolean;
  allowHome: boolean;
  allowLang: boolean;
  allowTemp: boolean;
  allowNode: boolean;
  customAllowlist: string[];
}

export interface ContextPermissions {
  allowProjectRoot: boolean;
  allowWorkspaceId: boolean;
  allowUserProfile: boolean;
}

export interface SecretsPermissions {
  mode: 'none' | 'allowlist' | 'all';
  allowlist: string[];
}

export interface ServerPermissions {
  env: EnvPermissions;
  context: ContextPermissions;
  secrets: SecretsPermissions;
}
```

### 2. Storage Extension

#### ServerTemplate (Global Permissions)

```typescript
export interface ServerTemplate {
  // ... existing fields ...

  // Global permissions for this server
  permissions?: ServerPermissions;
}
```

#### WorkspaceServerConfig (Workspace Override)

```typescript
export interface WorkspaceServerConfig {
  enabled: boolean;
  configOverride?: Record<string, unknown>;
  secretKeys?: string[];  // DEPRECATED - use permissions.secrets

  // Workspace-level permission overrides
  permissionsOverride?: Partial<ServerPermissions>;
}
```

### 3. ProcessManager Changes

Modify `buildEnvironment()` to respect permissions:

```typescript
private async buildEnvironment(
  serverId: string,
  workspaceId: string,
  port: number,
  projectRoot?: string,
  defaultConfig?: Record<string, unknown>,
  configOverride?: Record<string, unknown>,
  userProfile?: { email: string; fullName: string } | null,
  permissions?: ServerPermissions  // NEW PARAMETER
): Promise<NodeJS.ProcessEnv> {

  // Get merged permissions (global + workspace override)
  const finalPermissions = permissions || DEFAULT_PERMISSIONS;

  // 1. Build filtered system env
  const filteredEnv = this.filterSystemEnv(finalPermissions.env);

  // 2. Build context variables
  const contextEnv = this.buildContextEnv(
    finalPermissions.context,
    projectRoot,
    workspaceId,
    userProfile
  );

  // 3. Build secrets (filtered by allowlist)
  const secretsEnv = await this.buildSecretsEnv(
    finalPermissions.secrets,
    serverId,
    workspaceId
  );

  return {
    ...filteredEnv,
    ...contextEnv,
    ...secretsEnv,
    MCP_PORT: String(port),
    MCP_HOST: '127.0.0.1',
    MCP_PATH: DEFAULT_MCP_PATH,
    MCP_SERVER_ID: serverId,
    MCP_CONFIG: JSON.stringify(config),
    NODE_ENV: 'production',
  };
}

private filterSystemEnv(envPerms: EnvPermissions): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};

  if (envPerms.allowPath) {
    result.PATH = process.env.PATH;
    result.PATHEXT = process.env.PATHEXT;
  }

  if (envPerms.allowHome) {
    result.HOME = process.env.HOME;
    result.USERPROFILE = process.env.USERPROFILE;
    result.HOMEPATH = process.env.HOMEPATH;
  }

  if (envPerms.allowLang) {
    result.LANG = process.env.LANG;
    result.LANGUAGE = process.env.LANGUAGE;
    // Copy all LC_* variables
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('LC_')) {
        result[key] = process.env[key];
      }
    }
  }

  if (envPerms.allowTemp) {
    result.TEMP = process.env.TEMP;
    result.TMP = process.env.TMP;
    result.TMPDIR = process.env.TMPDIR;
  }

  if (envPerms.allowNode) {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('NODE_') || key.startsWith('npm_')) {
        result[key] = process.env[key];
      }
    }
  }

  // Custom allowlist
  for (const key of envPerms.customAllowlist) {
    if (process.env[key]) {
      result[key] = process.env[key];
    }
  }

  return result;
}
```

### 4. New Store: PermissionsStore

```typescript
// src/host/stores/PermissionsStore.ts

export class PermissionsStore {
  /**
   * Get merged permissions for a server in a workspace
   * Priority: workspace override > global > defaults
   */
  async getEffectivePermissions(
    serverId: string,
    workspaceId: string
  ): Promise<ServerPermissions> {
    // Get global permissions from ServerTemplate
    const server = await this.serverStore.get(serverId);
    const globalPerms = server?.permissions || DEFAULT_PERMISSIONS;

    // Get workspace override
    const workspace = await this.workspaceStore.get(workspaceId);
    const serverConfig = workspace?.servers?.[serverId];
    const workspaceOverride = serverConfig?.permissionsOverride;

    // Merge with priority
    return this.mergePermissions(globalPerms, workspaceOverride);
  }

  private mergePermissions(
    global: ServerPermissions,
    override?: Partial<ServerPermissions>
  ): ServerPermissions {
    if (!override) return global;

    return {
      env: { ...global.env, ...override.env },
      context: { ...global.context, ...override.context },
      secrets: override.secrets || global.secrets,
    };
  }
}
```

### 5. API Endpoints

Add new endpoints for managing permissions:

```
GET  /api/servers/:serverId/permissions          - Get global permissions
PUT  /api/servers/:serverId/permissions          - Update global permissions

GET  /api/workspaces/:wpId/servers/:serverId/permissions  - Get effective (merged)
PUT  /api/workspaces/:wpId/servers/:serverId/permissions  - Update workspace override
DELETE /api/workspaces/:wpId/servers/:serverId/permissions - Remove workspace override (use global)
```

### 6. UI Components

#### New Tab in ServerDetailPage

Add "Permissions" tab after "Secrets":

```typescript
type ServerTab = 'overview' | 'config' | 'secrets' | 'permissions';

const mainTabs = [
  { id: 'overview', label: 'Overview', icon: <Info /> },
  { id: 'config', label: 'Config', icon: <Settings /> },
  { id: 'secrets', label: 'Secrets', icon: <Key /> },
  { id: 'permissions', label: 'Permissions', icon: <Shield /> },
];
```

#### ServerPermissionsEditor Component

```typescript
// src/renderer/components/servers/ServerPermissionsEditor.tsx

interface ServerPermissionsEditorProps {
  serverId: string;
  workspaceId: string;
  serverName: string;
}

export function ServerPermissionsEditor(props: ServerPermissionsEditorProps) {
  // Loads global permissions + workspace override
  // Shows tabs: "Global" | "Workspace" (if workspaceId !== 'global')
  // For workspace: shows "Inherit from Global" option

  return (
    <div>
      {/* Level selector: Global / Workspace */}
      <Tabs>
        <Tab id="global">Global Settings</Tab>
        <Tab id="workspace">Workspace Override</Tab>
      </Tabs>

      {/* ENV Variables section */}
      <Section title="System Environment Variables">
        <Checkbox label="Allow PATH variables" field="env.allowPath" />
        <Checkbox label="Allow HOME/User directory" field="env.allowHome" />
        <Checkbox label="Allow Language/Locale" field="env.allowLang" />
        <Checkbox label="Allow Temp directories" field="env.allowTemp" />
        <Checkbox label="Allow Node.js variables" field="env.allowNode" />
        <TagInput
          label="Custom variables allowlist"
          field="env.customAllowlist"
          placeholder="Add variable name..."
        />
      </Section>

      {/* Context section */}
      <Section title="Workspace Context">
        <Checkbox label="Allow Project Root path" field="context.allowProjectRoot" />
        <Checkbox label="Allow Workspace ID" field="context.allowWorkspaceId" />
        <Checkbox label="Allow User Profile" field="context.allowUserProfile" />
      </Section>

      {/* Secrets section */}
      <Section title="Secrets Access">
        <RadioGroup field="secrets.mode">
          <Radio value="none">No secrets</Radio>
          <Radio value="allowlist">Selected secrets only</Radio>
          <Radio value="all">All available secrets</Radio>
        </RadioGroup>

        {mode === 'allowlist' && (
          <SecretSelector
            availableSecrets={availableSecrets}
            selected={permissions.secrets.allowlist}
            onChange={...}
          />
        )}
      </Section>
    </div>
  );
}
```

## Implementation Order

### Phase 1: Core Backend (Types & Storage)
1. Add permission types to `shared/types.ts`
2. Update `ServerTemplate` interface
3. Update `WorkspaceServerConfig` interface
4. Create `DEFAULT_PERMISSIONS` constant
5. Add migration for existing servers (set default permissions)

### Phase 2: ProcessManager Security
1. Create helper methods: `filterSystemEnv`, `buildContextEnv`, `buildSecretsEnv`
2. Modify `buildEnvironment()` to accept permissions
3. Update `start()` to fetch and pass permissions
4. Add logging for permission application

### Phase 3: API Layer
1. Create PermissionsStore (or extend ServerStore)
2. Add API endpoints for CRUD operations
3. Add validation for permission structures

### Phase 4: UI Components
1. Create `ServerPermissionsEditor` component
2. Add "Permissions" tab to `ServerDetailPage`
3. Add workspace-level toggle/inheritance UI
4. Add help text explaining each permission

### Phase 5: Testing & Documentation
1. Test with various permission configurations
2. Test workspace override inheritance
3. Update user documentation
4. Add migration notes

## Security Considerations

1. **Secure by Default**: New servers start with minimal permissions
2. **Explicit Allowlist**: Users must explicitly enable each permission category
3. **No Wildcards**: Secrets use explicit key names, not patterns
4. **Audit Trail**: Consider logging permission changes
5. **UI Warnings**: Show warning when enabling "all secrets" mode

## Migration Strategy

For existing servers:
1. Default to current behavior initially (backward compatible)
2. Show warning banner: "This server has unrestricted access to environment variables"
3. Encourage users to configure permissions

```typescript
// Migration: existing servers get permissive defaults
const LEGACY_PERMISSIONS: ServerPermissions = {
  env: {
    allowPath: true,
    allowHome: true,
    allowLang: true,
    allowTemp: true,
    allowNode: true,
    customAllowlist: ['*'],  // Special: allow all
  },
  context: {
    allowProjectRoot: true,
    allowWorkspaceId: true,
    allowUserProfile: true,
  },
  secrets: {
    mode: 'all',
    allowlist: [],
  },
};
```

## Files to Create/Modify

### New Files
- `src/shared/permissions.ts` - Types and defaults
- `src/host/stores/PermissionsStore.ts` - Permission management
- `src/renderer/components/servers/ServerPermissionsEditor.tsx` - UI component

### Modified Files
- `src/shared/types.ts` - Add permission types
- `src/host/managers/ProcessManager.ts` - Security implementation
- `src/host/http/router.ts` - API endpoints
- `src/renderer/components/servers/ServerDetailPage.tsx` - Add Permissions tab
- `src/renderer/stores/appStore.ts` - Permission state management
