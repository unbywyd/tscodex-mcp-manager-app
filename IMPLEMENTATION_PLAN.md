# MCP Manager - План реализации

## Текущее состояние

### Что работает:
- Electron приложение запускается
- UI отрисовывается (Titlebar, Sidebar, MainContent)
- Preload скрипт загружается (CJS формат)
- HTTP сервер на порту 4040

### Что НЕ работает:
- API запросы не проходят (нужно отладить host process)
- Кнопки UI не функционируют (зависят от API)
- WebSocket не подключается

---

## Архитектура секретов

### Текущая реализация (НЕПРАВИЛЬНАЯ):
- Dropdown для выбора сервера
- Секреты привязаны к конкретному серверу
- Нативный select (некрасиво)

### Правильная архитектура:

```
Секреты существуют на уровне:
├── Global (глобальные для всех серверов)
└── Workspace (для конкретного воркспейса)

Секреты для конкретного сервера:
└── Настраиваются через меню сервера → модальное окно конфигурации
```

### Новый UI секретов:

```
┌─────────────────────────────────────────────────────────────┐
│ Secrets                                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ Add Secret ─────────────────────────────────────────┐   │
│  │  Key:   [________________________]                    │   │
│  │  Value: [________________________]                    │   │
│  │                                    [Add]              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Existing Secrets ───────────────────────────────────┐   │
│  │                                                       │   │
│  │  API_KEY                          (Global)  [✏️] [🗑️] │   │
│  │  DATABASE_URL                     (Global)  [✏️] [🗑️] │   │
│  │  OPENAI_API_KEY                (Workspace)  [✏️] [🗑️] │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ⚠️ Unsaved changes                                         │
│                                                              │
│  [Save & Restart Servers]                                   │
│                                                              │
│  ┌─ Restarting... ──────────────────────────────────────┐   │
│  │  ████████████░░░░░░░░  3/5 servers restarted         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Логика работы:
1. Пользователь добавляет/редактирует/удаляет секреты
2. Изменения локальные (не применяются сразу)
3. Индикатор "Unsaved changes" показывает что есть несохранённые изменения
4. Кнопка "Save & Restart Servers" применяет все изменения
5. При сохранении:
   - Секреты сохраняются в keychain
   - ВСЕ запущенные серверы перезапускаются с новыми ENV
   - Показывается прогресс перезапуска
   - Блокируется UI до завершения

---

## Архитектура серверов

### Добавление сервера

**Кнопка:** "Add MCP Server" → Открывает модальное окно

**Модальное окно:**
```
┌─────────────────────────────────────────────────────────────┐
│ Add MCP Server                                          [X] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Install Type:                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ○ NPX (npx)                                          │   │
│  │ ○ PNPX (pnpm dlx)                                    │   │
│  │ ○ Yarn (yarn dlx)                                    │   │
│  │ ○ Bunx (bunx)                                        │   │
│  │ ○ Local (local path)                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Package Name: (if not local)                               │
│  [_______________________________________]                  │
│                                                              │
│  Package Version: (optional)                                │
│  [_______________________________________]                  │
│                                                              │
│  Local Path: (if local)                                     │
│  [_______________________________________] [Browse]         │
│                                                              │
│                              [Cancel]  [Add Server]         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Конфигурация сервера

**Открывается через:** Меню сервера (⚙️ или три точки → Settings)

**Модальное окно:**
```
┌─────────────────────────────────────────────────────────────┐
│ Configure: @anthropic/mcp-server-filesystem             [X] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ Tabs ───────────────────────────────────────────────┐   │
│  │ [General] [Environment] [Secrets]                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  == General Tab ==                                          │
│  Display Name: [Filesystem Server____________]              │
│  Description:  [Access local files___________]              │
│  Enabled:      [✓]                                          │
│                                                              │
│  == Environment Tab ==                                      │
│  KEY=VALUE pairs that will be passed to the server          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ALLOWED_PATHS = /home/user/projects                  │   │
│  │ MAX_FILE_SIZE = 10MB                         [🗑️]    │   │
│  │ [+ Add Environment Variable]                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  == Secrets Tab ==                                          │
│  Secrets specific to this server (from keychain)            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ API_KEY = ********                           [🗑️]    │   │
│  │ [+ Add Secret]                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│                              [Cancel]  [Save]               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Архитектура воркспейсов

### Добавление воркспейса

**Кнопка:** "+ Add Workspace" → Открывает модальное окно

**Модальное окно:**
```
┌─────────────────────────────────────────────────────────────┐
│ Add Workspace                                           [X] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Label:                                                     │
│  [_______________________________________]                  │
│                                                              │
│  Project Root:                                              │
│  [_______________________________________] [Browse]         │
│                                                              │
│                              [Cancel]  [Create]             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## План реализации

### Фаза 1: Исправление базовой функциональности

#### 1.1 Отладка Host процесса
- [ ] Добавить логирование в host/index.ts
- [ ] Проверить что HTTP сервер слушает на 4040
- [ ] Проверить что роуты регистрируются
- [ ] Тестировать API через curl/Postman

#### 1.2 Проверка IPC
- [ ] Убедиться что preload.cjs загружается
- [ ] Проверить window.electronAPI в консоли DevTools
- [ ] Тестировать кнопки minimize/maximize/close

#### 1.3 WebSocket соединение
- [ ] Проверить что WS сервер запускается
- [ ] Отладить подключение из renderer

### Фаза 2: Компонентная система

#### 2.1 Создать общие компоненты
```
src/renderer/components/common/
├── Modal.tsx           - Базовый модальный компонент
├── Button.tsx          - Кнопка с вариантами (primary, secondary, danger, icon)
├── Input.tsx           - Текстовое поле
├── Select.tsx          - Кастомный select (не нативный!)
├── RadioGroup.tsx      - Группа radio кнопок
├── Checkbox.tsx        - Чекбокс
├── ProgressBar.tsx     - Индикатор прогресса
├── Spinner.tsx         - Загрузка
├── ConfirmDialog.tsx   - Диалог подтверждения
└── Toast.tsx           - Уведомления
```

#### 2.2 Модальная система
- [ ] Modal с overlay и закрытием по Esc
- [ ] ConfirmDialog для удаления
- [ ] Анимации появления/исчезновения

### Фаза 3: Secrets (Новый UI)

#### 3.1 Редизайн SecretsView
- [ ] Убрать dropdown выбора сервера
- [ ] Форма добавления: Key + Value + Add
- [ ] Список секретов с scope (Global/Workspace)
- [ ] Кнопки Edit и Delete для каждого секрета
- [ ] ConfirmDialog для удаления
- [ ] Индикатор несохранённых изменений
- [ ] Кнопка "Save & Restart Servers"
- [ ] Progress bar при перезапуске серверов

#### 3.2 Backend для restart
- [ ] Endpoint POST /api/instances/restart-all
- [ ] Логика перезапуска всех серверов с новыми ENV
- [ ] WebSocket события о прогрессе

### Фаза 4: Servers (Модальные окна)

#### 4.1 AddServerModal
- [ ] Radio group для выбора installType
- [ ] Условные поля (packageName или localPath)
- [ ] Валидация
- [ ] Интеграция с API POST /api/servers

#### 4.2 ServerConfigModal
- [ ] Tabs: General, Environment, Secrets
- [ ] Форма редактирования
- [ ] Интеграция с API PATCH /api/servers/:id

### Фаза 5: Workspaces

#### 5.1 AddWorkspaceModal
- [ ] Поля: Label, Project Root
- [ ] Кнопка Browse для выбора папки
- [ ] Интеграция с API POST /api/workspaces

### Фаза 6: Полировка

#### 6.1 Error handling
- [ ] Toast уведомления об ошибках
- [ ] Graceful degradation

#### 6.2 UX улучшения
- [ ] Keyboard shortcuts
- [ ] Loading states везде
- [ ] Empty states

---

## Приоритеты (порядок выполнения)

1. **КРИТИЧНО:** Отладить host процесс и API
2. **КРИТИЧНО:** Исправить IPC (кнопки окна)
3. Создать Modal и ConfirmDialog компоненты
4. Переделать SecretsView по новой архитектуре
5. Создать AddServerModal
6. Создать ServerConfigModal
7. Создать AddWorkspaceModal
8. Добавить Toast уведомления

---

## Технические заметки

### Нативные элементы - НЕ ИСПОЛЬЗОВАТЬ:
- `<select>` - заменить на кастомный Select
- `confirm()` - заменить на ConfirmDialog
- `alert()` - заменить на Toast

### Перезапуск серверов при изменении секретов:
```typescript
// Логика в host/managers/ProcessManager.ts
async restartAllWithNewEnv(secrets: Record<string, string>): Promise<void> {
  const instances = this.getAllInstances().filter(i => i.status === 'running');

  for (const instance of instances) {
    this.eventBus.emit('restart-progress', {
      current: index,
      total: instances.length,
      serverId: instance.serverId
    });

    await this.stop(instance.serverId, instance.workspaceId);
    await this.start(instance.serverId, instance.workspaceId, instance.projectRoot, {
      ...instance.config,
      env: { ...instance.config.env, ...secrets }
    });
  }
}
```

### Передача секретов в ENV:
Секреты должны передаваться как environment variables при запуске процесса:
```typescript
// В ProcessManager.start()
const env = {
  ...process.env,
  ...config.env,
  ...await this.secretStore.getSecretsForServer(serverId, workspaceId)
};

spawn(command, args, { env });
```
