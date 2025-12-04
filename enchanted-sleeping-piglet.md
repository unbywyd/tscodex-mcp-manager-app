# План: AI Assistant таб для MCP Tools

## Обзор задачи

Добавить 4-й таб "AI Assistant" в `McpToolsPage` для конфигурации LLM провайдера.

**Цель:** Внутренний AI-сервис приложения для умной генерации tools/prompts/resources через структурированный вывод. Агент доступен только приложению через внутренний API.

## Решение по библиотеке

**Выбор:** Официальный `openai` SDK с кастомным `baseUrl`

**Преимущества:**
- Единый интерфейс для всех OpenAI-совместимых провайдеров
- Поддержка `response_format: { type: 'json_schema' }` для structured output
- Минимум зависимостей, хорошая поддержка TypeScript

**Совместимые провайдеры:**
| Провайдер | Base URL | Structured Output |
|-----------|----------|-------------------|
| OpenAI | `https://api.openai.com/v1` | ✅ GPT-4o, GPT-4o-mini |
| OpenRouter | `https://openrouter.ai/api/v1` | ✅ Зависит от модели |
| Groq | `https://api.groq.com/openai/v1` | ✅ Llama 3.1+ |
| Together.ai | `https://api.together.xyz/v1` | ✅ Некоторые модели |
| Ollama | `http://localhost:11434/v1` | ⚠️ Ограничено |

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                        RENDERER                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ McpToolsPage                                              │  │
│  │  ├── Tools tab                                            │  │
│  │  ├── Prompts tab                                          │  │
│  │  ├── Resources tab                                        │  │
│  │  └── AI Assistant tab (NEW)                               │  │
│  │        └── AIAssistantSettings.tsx                        │  │
│  │              ├── Provider selector (preset + custom URL)  │  │
│  │              ├── API Key input (masked)                   │  │
│  │              ├── Model name input                         │  │
│  │              └── "Verify" button → показывает статус      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ IPC (secrets) + HTTP API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          HOST                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ SecretStore (keytar) - ОТДЕЛЬНЫЙ КЛЮЧ для AI              │  │
│  │   └── __ai-assistant__:API_KEY                            │  │
│  │   └── __ai-assistant__:BASE_URL                           │  │
│  │   └── __ai-assistant__:MODEL                              │  │
│  │   └── __ai-assistant__:PROVIDER                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ AIAgent (NEW) - внутренний сервис приложения              │  │
│  │   └── src/host/ai/AIAgent.ts                              │  │
│  │         ├── isConfigured(): boolean                       │  │
│  │         ├── initialize(): Promise<boolean>                │  │
│  │         ├── verify(): Promise<VerifyResult>               │  │
│  │         └── structuredOutput<T>(prompt, schema): T        │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ API Routes (внутренние, только для приложения)            │  │
│  │   └── POST /api/ai/verify                                 │  │
│  │   └── GET  /api/ai/status                                 │  │
│  │   └── POST /api/ai/generate (будущее)                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Файлы для создания/изменения

### Новые файлы

| Файл | Назначение |
|------|-----------|
| `src/renderer/components/mcp-tools/AIAssistantSettings.tsx` | UI компонент настроек AI |
| `src/host/ai/AIAgent.ts` | Агент для работы с LLM |
| `src/host/ai/types.ts` | Типы для AI модуля |
| `src/host/api/routes/ai.ts` | API endpoints для AI |

### Изменяемые файлы

| Файл | Изменения |
|------|-----------|
| `src/renderer/components/mcp-tools/McpToolsPage.tsx` | Добавить 4-й таб "AI Assistant" |
| `src/host/stores/SecretStore.ts` | Добавить методы для AI secrets (`__ai-assistant__`) |
| `src/host/index.ts` | Подключить AI routes, создать AIAgent |
| `src/main/index.ts` | Добавить IPC handlers для AI config |
| `src/main/preload.ts` | Экспортировать AI API |
| `src/shared/types.ts` | Добавить AI типы и пресеты провайдеров |
| `package.json` | Добавить зависимость `openai` |

---

## Детальный план реализации

### Шаг 1: Установка зависимости

```bash
npm install openai
```

### Шаг 2: Типы (src/shared/types.ts)

```typescript
// Добавить:
export interface AIAssistantConfig {
  provider: string;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;  // Флаг наличия ключа (сам ключ только в keytar)
}

export interface AIProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
}

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o' },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.1-70b-versatile' },
  { id: 'together', name: 'Together.ai', baseUrl: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Llama-3-70b-chat-hf' },
  { id: 'ollama', name: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3' },
  { id: 'custom', name: 'Custom', baseUrl: '', defaultModel: '' },
];
```

### Шаг 3: AI Agent (src/host/ai/AIAgent.ts)

```typescript
import OpenAI from 'openai';
import type { SecretStore } from '../stores/SecretStore';

const AI_ASSISTANT_KEY = '__ai-assistant__';

export class AIAgent {
  private client: OpenAI | null = null;
  private model: string = '';
  private configured: boolean = false;

  constructor(private secretStore: SecretStore) {}

  /**
   * Проверяет наличие конфигурации (без инициализации клиента)
   */
  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Загружает конфигурацию из SecretStore и инициализирует клиент
   */
  async initialize(): Promise<boolean> {
    const apiKey = await this.secretStore.getAISecret('API_KEY');
    const baseUrl = await this.secretStore.getAISecret('BASE_URL');
    const model = await this.secretStore.getAISecret('MODEL');

    if (!apiKey || !baseUrl || !model) {
      this.configured = false;
      this.client = null;
      return false;
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });
    this.model = model;
    this.configured = true;
    return true;
  }

  /**
   * Проверяет валидность API ключа простым запросом
   */
  async verify(): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'AI not configured' };
    }

    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Выполняет запрос и возвращает структурированный JSON ответ
   */
  async structuredOutput<T>(
    prompt: string,
    schema: object,
    schemaName: string = 'response'
  ): Promise<T> {
    if (!this.client) throw new Error('AI not configured');

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: { name: schemaName, schema, strict: true },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from AI');

    return JSON.parse(content) as T;
  }
}
```

### Шаг 4: API Route (src/host/api/routes/ai.ts)

```typescript
import type { McpHost } from '../../index';

export function registerAIRoutes(host: McpHost) {
  // GET /api/ai/status - статус AI (настроен ли)
  host.router.get('/api/ai/status', async (_req, res) => {
    const agent = host.getAIAgent();
    return res.json({
      success: true,
      configured: agent.isConfigured(),
    });
  });

  // POST /api/ai/verify - проверка API ключа
  host.router.post('/api/ai/verify', async (_req, res) => {
    const agent = host.getAIAgent();

    // Переинициализировать с новыми настройками
    const initialized = await agent.initialize();
    if (!initialized) {
      return res.json({
        success: false,
        error: 'AI not configured. Set API Key, Base URL and Model.',
      });
    }

    const result = await agent.verify();
    return res.json(result);
  });

  // GET /api/ai/config - получить конфиг (без API key!)
  host.router.get('/api/ai/config', async (_req, res) => {
    const store = host.getSecretStore();

    const baseUrl = await store.getAISecret('BASE_URL');
    const model = await store.getAISecret('MODEL');
    const provider = await store.getAISecret('PROVIDER');
    const hasApiKey = !!(await store.getAISecret('API_KEY'));

    return res.json({
      success: true,
      config: { baseUrl, model, provider, hasApiKey },
    });
  });
}
```

### Шаг 5: SecretStore - добавить методы для AI (src/host/stores/SecretStore.ts)

```typescript
// Добавить в класс SecretStore:

private readonly AI_ASSISTANT_KEY = '__ai-assistant__';

/**
 * Получить AI секрет
 */
async getAISecret(key: string): Promise<string | null> {
  try {
    return await keytar.getPassword(SERVICE_NAME, `${this.AI_ASSISTANT_KEY}:${key}`);
  } catch (error) {
    console.error('Failed to get AI secret:', error);
    return null;
  }
}

/**
 * Установить AI секрет
 */
async setAISecret(key: string, value: string): Promise<void> {
  try {
    await keytar.setPassword(SERVICE_NAME, `${this.AI_ASSISTANT_KEY}:${key}`, value);
  } catch (error) {
    console.error('Failed to set AI secret:', error);
    throw error;
  }
}

/**
 * Удалить AI секрет
 */
async deleteAISecret(key: string): Promise<boolean> {
  try {
    return await keytar.deletePassword(SERVICE_NAME, `${this.AI_ASSISTANT_KEY}:${key}`);
  } catch (error) {
    console.error('Failed to delete AI secret:', error);
    return false;
  }
}
```

### Шаг 6: UI Компонент (src/renderer/components/mcp-tools/AIAssistantSettings.tsx)

```typescript
import { useState, useEffect } from 'react';
import { Bot, Check, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { AI_PROVIDER_PRESETS } from '../../../shared/types';
import { cn } from '../../lib/utils';

export function AIAssistantSettings() {
  const [provider, setProvider] = useState('openai');
  const [baseUrl, setBaseUrl] = useState(AI_PROVIDER_PRESETS[0].baseUrl);
  const [model, setModel] = useState(AI_PROVIDER_PRESETS[0].defaultModel);
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; error?: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await fetch('http://127.0.0.1:4040/api/ai/config');
      const data = await res.json();
      if (data.success && data.config) {
        setProvider(data.config.provider || 'openai');
        setBaseUrl(data.config.baseUrl || AI_PROVIDER_PRESETS[0].baseUrl);
        setModel(data.config.model || AI_PROVIDER_PRESETS[0].defaultModel);
        setHasApiKey(data.config.hasApiKey);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderChange = (id: string) => {
    const preset = AI_PROVIDER_PRESETS.find(p => p.id === id);
    if (preset) {
      setProvider(id);
      setBaseUrl(preset.baseUrl);
      setModel(preset.defaultModel);
      setVerifyResult(null);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setVerifyResult(null);

    try {
      // Сохраняем через IPC
      await window.electronAPI?.setAISecret('PROVIDER', provider);
      await window.electronAPI?.setAISecret('BASE_URL', baseUrl);
      await window.electronAPI?.setAISecret('MODEL', model);
      if (apiKey) {
        await window.electronAPI?.setAISecret('API_KEY', apiKey);
        setHasApiKey(true);
        setApiKey(''); // Очищаем после сохранения
      }

      // Проверяем
      const res = await fetch('http://127.0.0.1:4040/api/ai/verify', { method: 'POST' });
      const result = await res.json();
      setVerifyResult(result);
    } catch (error: any) {
      setVerifyResult({ success: false, error: error.message });
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Bot className="w-5 h-5 text-purple-400" />
        <h2 className="text-base font-medium">AI Assistant</h2>
      </div>

      <p className="text-sm text-gray-400">
        Configure LLM provider for AI-powered features like smart tool generation.
      </p>

      {/* Provider */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Provider</label>
        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
        >
          {AI_PROVIDER_PRESETS.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Base URL */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Base URL</label>
        <input
          type="url"
          value={baseUrl}
          onChange={(e) => { setBaseUrl(e.target.value); setVerifyResult(null); }}
          placeholder="https://api.openai.com/v1"
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm font-mono"
        />
      </div>

      {/* API Key */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">API Key</label>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setVerifyResult(null); }}
            placeholder={hasApiKey ? '••••••••••••••••' : 'sk-...'}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 pr-10 text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
          >
            {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">Stored securely in OS Keychain.</p>
      </div>

      {/* Model */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Model</label>
        <input
          type="text"
          value={model}
          onChange={(e) => { setModel(e.target.value); setVerifyResult(null); }}
          placeholder="gpt-4o"
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm font-mono"
        />
      </div>

      {/* Verify Button */}
      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={handleVerify}
          disabled={isVerifying || !baseUrl || !model || (!apiKey && !hasApiKey)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors',
            'bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isVerifying ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Verify
        </button>

        {verifyResult && (
          <span className={cn(
            'flex items-center gap-1.5 text-sm',
            verifyResult.success ? 'text-green-400' : 'text-red-400'
          )}>
            {verifyResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
            {verifyResult.success ? 'Connected!' : verifyResult.error}
          </span>
        )}
      </div>
    </div>
  );
}
```

### Шаг 7: Обновить McpToolsPage.tsx

```typescript
// Добавить импорт
import { AIAssistantSettings } from './AIAssistantSettings';
import { Bot } from 'lucide-react';

// Расширить тип табов
type McpToolsTab = 'tools' | 'prompts' | 'resources' | 'ai';

// Добавить таб в массив tabs (после resources)
{
  id: 'ai' as const,
  label: 'AI Assistant',
  icon: Bot,
  // Без count - это не список элементов
}

// Добавить рендеринг контента в области {selectedTab === ...}
{selectedTab === 'ai' && <AIAssistantSettings />}
```

### Шаг 8: IPC Handlers (src/main/index.ts)

```typescript
// Добавить handlers для AI secrets
ipcMain.handle('ai:set-secret', async (_event, key: string, value: string) => {
  await mcpHost?.getSecretStore().setAISecret(key, value);
});

ipcMain.handle('ai:get-secret', async (_event, key: string) => {
  return mcpHost?.getSecretStore().getAISecret(key);
});

ipcMain.handle('ai:delete-secret', async (_event, key: string) => {
  return mcpHost?.getSecretStore().deleteAISecret(key);
});
```

### Шаг 9: Preload (src/main/preload.ts)

```typescript
// Добавить в contextBridge.exposeInMainWorld('electronAPI', { ... })
setAISecret: (key: string, value: string) =>
  ipcRenderer.invoke('ai:set-secret', key, value),
getAISecret: (key: string) =>
  ipcRenderer.invoke('ai:get-secret', key),
deleteAISecret: (key: string) =>
  ipcRenderer.invoke('ai:delete-secret', key),
```

### Шаг 10: McpHost - добавить AIAgent (src/host/index.ts)

```typescript
import { AIAgent } from './ai/AIAgent';

class McpHost {
  private aiAgent: AIAgent;

  constructor() {
    // ...existing code...
    this.aiAgent = new AIAgent(this.secretStore);
  }

  getAIAgent(): AIAgent {
    return this.aiAgent;
  }

  async start(port: number) {
    // ...existing code...

    // Инициализировать AI Agent если настроен
    await this.aiAgent.initialize();

    // Подключить AI routes
    registerAIRoutes(this);
  }
}
```

---

## Безопасность

1. **API Key хранится ТОЛЬКО в OS Keychain** (keytar)
2. **Никогда не передаётся через HTTP** - только IPC
3. **Никогда не логируется**
4. **UI показывает только placeholder если ключ уже установлен**

---

## Порядок выполнения

1. `npm install openai`
2. Типы в `src/shared/types.ts`
3. `src/host/stores/SecretStore.ts` - добавить методы `getAISecret`, `setAISecret`, `deleteAISecret`
4. `src/host/ai/AIAgent.ts` - создать класс агента
5. `src/host/api/routes/ai.ts` - создать API endpoints
6. `src/host/index.ts` - интегрировать AIAgent и routes
7. `src/main/index.ts` - добавить IPC handlers
8. `src/main/preload.ts` - экспортировать API
9. `src/renderer/components/mcp-tools/AIAssistantSettings.tsx` - создать UI
10. `src/renderer/components/mcp-tools/McpToolsPage.tsx` - добавить 4-й таб

---

## Будущее использование

AIAgent - внутренний сервис для AI-powered функций:
- Умная генерация tools/prompts/resources (кнопка "Generate with AI")
- Структурированный вывод для заполнения форм
