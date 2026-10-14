# Refactor Plan: Hypervisor + Telegram Clients - OOP Architecture

## Current Architecture Problems

1. **Singleton Anti-Pattern**: `Hypervisor`, `HypervisorLayer`, `CampaignLayer` all use singletons → hard to test, hidden dependencies
2. **No Interfaces/Abstractions**: Direct coupling to concrete implementations
3. **Mixed Responsibilities**: `isolated.telegram.ts` mixes types, factory functions, and business logic
4. **Tight Coupling**: `TelegramBotAdapter` directly depends on `$hypervisorLayer` singleton
5. **No Dependency Injection**: Impossible to swap implementations for testing
6. **Worker RPC Duplication**: Similar patterns in `WorkerRpcClient`/`WorkerRpcHostClient`
7. **Inconsistent OOP Style**: Classes, namespaces, and plain functions mixed
8. **God Classes**: `Hypervisor` handles config, client lifecycle, worker communication

---

## Target Architecture

### Core Principles
- **Interface Segregation**: Small, focused interfaces
- **Dependency Inversion**: Depend on abstractions, not concretions
- **Single Responsibility**: Each class has one reason to change
- **Composition over Inheritance**: Favor composition
- **Explicit Dependencies**: Constructor injection
- **Testability**: Every component testable in isolation

---

## New Package Structure

```
src/
├── core/
│   ├── interfaces/           # All interfaces (contracts)
│   │   ├── telegram-client.ts
│   │   ├── client-manager.ts
│   │   ├── config-loader.ts
│   │   ├── worker-rpc.ts
│   │   └── bot-adapter.ts
│   ├── domain/               # Pure domain logic (no external deps)
│   │   ├── client-factory.ts
│   │   ├── address-generator.ts
│   │   ├── config-schema.ts
│   │   └── validators.ts
│   ├── infrastructure/       # External integrations
│   │   ├── mtcute-client-factory.ts
│   │   ├── sqlite-storage.ts
│   │   ├── file-config-loader.ts
│   │   └── bun-worker-rpc.ts
│   ├── application/          # Use cases / orchestration
│   │   ├── hypervisor-service.ts
│   │   ├── autoload-use-case.ts
│   │   └── client-lifecycle.ts
│   └── index.ts              # Composition root
├── adapters/
│   └── telegram/
│       ├── bot-adapter.ts    # Telegraf wrapper
│       ├── command-handlers/ # Individual command classes
│       └── import-handler.ts # ZIP import logic
├── workers/
│   ├── hypervisor-worker.ts  # Thin worker entry point
│   └── campaign-worker.ts
└── composition-root.ts       # Main wiring (replaces index.ts)
```

---

## Phase 1: Define Interfaces (Contracts)

### `src/core/interfaces/telegram-client.ts`
```typescript
export interface ITelegramClient {
  readonly client: TelegramClient;  // mtcute client
  readonly me: User;
  readonly address: string;
  readonly folders: ClientFolders;
  
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

export interface ClientFolders {
  storage: string;
  importTdata?: string;
}

export interface IClientOptions {
  apiId: number;
  apiHash: string;
  proxy?: HttpProxySettings;
}
```

### `src/core/interfaces/client-manager.ts`
```typescript
export interface IClientManager {
  spawn(name: string, tdataPath: string, options: IClientOptions): Promise<string>;
  get(address: string): ITelegramClient | undefined;
  getAll(): ReadonlyMap<string, ITelegramClient>;
  remove(address: string): Promise<boolean>;
  getAllAddresses(): string[];
}
```

### `src/core/interfaces/config-loader.ts`
```typescript
export interface IConfigLoader {
  load(path: string): Promise<AutoloadConfig>;
  createDefault(path: string): Promise<void>;
}

export interface AutoloadConfig {
  hypervisor: { prefetch: AutoloadAccount[] };
}

export interface AutoloadAccount {
  name: string;
  tdata: string;
  options?: Record<string, unknown>;
}
```

### `src/core/interfaces/worker-rpc.ts`
```typescript
export interface IRpcClient<TMethod extends string> {
  call<T>(method: TMethod, params?: unknown): Promise<T>;
  terminate(): void;
  readonly isWorkerAlive: boolean;
}

export interface IRpcHost {
  registerHandler(method: string, handler: RpcHandler): void;
  call<T>(method: string, params?: unknown): Promise<T>;
}

export type RpcHandler = (params: unknown) => Promise<unknown> | unknown;
```

### `src/core/interfaces/bot-adapter.ts`
```typescript
export interface IBotAdapter {
  start(): void;
  stop(): void;
}

export interface IBotCommandHandler {
  handle(ctx: Context): Promise<void>;
}
```

---

## Phase 2: Domain Layer (Pure Logic, No External Deps)

### `src/core/domain/address-generator.ts`
```typescript
export class AddressGenerator {
  generate(stringBased?: string): string {
    // deterministic or random address
  }
}
```

### `src/core/domain/config-schema.ts`
```typescript
export class ConfigValidator {
  validateAutoloadConfig(config: unknown): AutoloadConfig;
  validateAccount(account: unknown): AutoloadAccount;
}
```

### `src/core/domain/client-factory.ts`
```typescript
export interface IClientFactory {
  create(name: string, tdataPath: string, options: IClientOptions): Promise<ITelegramClient>;
  createFromExisting(name: string, options: IClientOptions): Promise<ITelegramClient>;
}
```

---

## Phase 3: Infrastructure Layer (External Integrations)

### `src/core/infrastructure/mtcute-client-factory.ts`
```typescript
export class MtCuteClientFactory implements IClientFactory {
  constructor(
    private readonly storageFactory: IStorageFactory,
    private readonly transportFactory: ITransportFactory
  ) {}
  
  async create(name: string, tdataPath: string, options: IClientOptions): Promise<ITelegramClient> {
    // Convert tdata, create storage, create TelegramClient
  }
  
  async createFromExisting(name: string, options: IClientOptions): Promise<ITelegramClient> {
    // Load existing session from storage
  }
}
```

### `src/core/infrastructure/file-config-loader.ts`
```typescript
export class FileConfigLoader implements IConfigLoader {
  async load(path: string): Promise<AutoloadConfig> { ... }
  async createDefault(path: string): Promise<void> { ... }
}
```

### `src/core/infrastructure/bun-worker-rpc.ts`
```typescript
export class BunRpcClient<TMethod extends string> implements IRpcClient<TMethod> {
  // WorkerRpcClient implementation
}

export class BunRpcHost implements IRpcHost {
  // WorkerRpcHostClient implementation
}
```

---

## Phase 4: Application Layer (Use Cases)

### `src/core/application/client-lifecycle.ts`
```typescript
export class ClientLifecycleService {
  constructor(
    private readonly clientManager: IClientManager,
    private readonly clientFactory: IClientFactory,
    private readonly addressGenerator: AddressGenerator
  ) {}
  
  async spawnClient(name: string, tdataPath: string, options: IClientOptions): Promise<string> {
    const address = this.addressGenerator.generate(name);
    if (this.clientManager.get(address)) return address;
    
    const client = await this.clientFactory.create(name, tdataPath, options);
    this.clientManager.register(address, client);
    return address;
  }
  
  async removeClient(address: string): Promise<boolean> { ... }
}
```

### `src/core/application/autoload-use-case.ts`
```typescript
export class AutoloadUseCase {
  constructor(
    private readonly configLoader: IConfigLoader,
    private readonly clientLifecycle: ClientLifecycleService,
    private readonly logger: ILogger
  ) {}
  
  async execute(configPath?: string): Promise<string[]> { ... }
}
```

### `src/core/application/hypervisor-service.ts`
```typescript
export class HypervisorService {
  constructor(
    private readonly clientManager: IClientManager,
    private readonly clientLifecycle: ClientLifecycleService,
    private readonly autoloadUseCase: AutoloadUseCase,
    private readonly logger: ILogger
  ) {}
  
  // Public API methods
  async spawnIRClient(name: string, path: string, options: Record<string, unknown>): Promise<string>
  async autoload(configPath?: string): Promise<string[]>
  getIRClient(address: string): ITelegramClient | undefined
  getAllIRClients(): ReadonlyMap<string, ITelegramClient>
  async removeIRClient(address: string): Promise<boolean>
  getAllIRCAddresses(): string[]
}
```

---

## Phase 5: Worker Layer (Thin Entry Points)

### `src/workers/hypervisor-worker.ts`
```typescript
// Thin worker - only wiring, no business logic
const host = new BunRpcHost();

const hypervisorService = createHypervisorService(); // From composition root

host.registerHandler('autoload', (params) => hypervisorService.autoload(params.configPath));
host.registerHandler('spawnIRClient', (params) => hypervisorService.spawnIRClient(params.name, params.path, params.options));
host.registerHandler('getIRClient', (params) => hypervisorService.getIRClient(params.address));
host.registerHandler('getAllIRClients', () => hypervisorService.getAllIRClients());
host.registerHandler('getAllIRCAddresses', () => hypervisorService.getAllIRCAddresses());
host.registerHandler('removeIRClient', (params) => hypervisorService.removeIRClient(params.address));
```

---

## Phase 6: Adapters (Telegram Bot)

### `src/adapters/telegram/command-handlers/hypervisors-command.ts`
```typescript
export class HypervisorsCommandHandler implements IBotCommandHandler {
  constructor(
    private readonly clientManager: IClientManager,
    private readonly presenter: IClientPresenter
  ) {}
  
  async handle(ctx: Context): Promise<void> { ... }
}
```

### `src/adapters/telegram/import-handler.ts`
```typescript
export class ZipImportHandler {
  constructor(
    private readonly clientLifecycle: ClientLifecycleService,
    private readonly fileDownloader: IFileDownloader,
    private readonly zipExtractor: IZipExtractor,
    private readonly tempFileManager: ITempFileManager
  ) {}
  
  async handleImport(ctx: Context): Promise<void> { ... }
}
```

### `src/adapters/telegram/bot-adapter.ts`
```typescript
export class TelegramBotAdapter implements IBotAdapter {
  constructor(
    private readonly bot: Telegraf,
    private readonly commandHandlers: Map<string, IBotCommandHandler>,
    private readonly importHandler: ZipImportHandler
  ) {}
  
  start(): void { ... }
  stop(): void { ... }
}
```

---

## Phase 7: Composition Root (Wiring)

### `src/composition-root.ts`
```typescript
// Single place where all dependencies are wired
export function createContainer() {
  // Domain
  const addressGenerator = new AddressGenerator();
  const configValidator = new ConfigValidator();
  
  // Infrastructure
  const storageFactory = new SqliteStorageFactory();
  const transportFactory = new TransportFactory();
  const clientFactory = new MtCuteClientFactory(storageFactory, transportFactory);
  const configLoader = new FileConfigLoader(configValidator);
  const rpcClient = new BunRpcClient<HypervisorMethod>(HYPERVISOR_WORKER_PATH);
  
  // Application
  const clientManager = new InMemoryClientManager(); // or persistent
  const clientLifecycle = new ClientLifecycleService(clientManager, clientFactory, addressGenerator);
  const autoloadUseCase = new AutoloadUseCase(configLoader, clientLifecycle, logger);
  const hypervisorService = new HypervisorService(clientManager, clientLifecycle, autoloadUseCase, logger);
  
  // Adapters
  const bot = new Telegraf(BOT_TOKEN);
  const hypervisorsHandler = new HypervisorsCommandHandler(clientManager, new ClientPresenter());
  const importHandler = new ZipImportHandler(clientLifecycle, new FileDownloader(), new ZipExtractor(), new TempFileManager());
  const botAdapter = new TelegramBotAdapter(bot, new Map([['hypervisors', hypervisorsHandler]]), importHandler);
  
  return {
    hypervisorService,
    botAdapter,
    rpcClient,
    // ... other services
  };
}
```

---

## Phase 8: Migration Strategy

### Step 1: Add Interfaces (No Breaking Changes)
- Create all interface files in `core/interfaces/`
- Make existing classes implement interfaces
- Keep singletons but expose interfaces

### Step 2: Extract Domain Logic
- Move pure logic to `core/domain/`
- Write unit tests for domain layer

### Step 3: Infrastructure Implementations
- Create infrastructure classes implementing interfaces
- Keep mtcute, fs, bun worker integrations here

### Step 4: Application Services
- Create use case classes in `core/application/`
- Wire domain + infrastructure

### Step 5: Worker Refactor
- Make workers thin entry points
- Remove business logic from workers

### Step 6: Adapter Refactor
- Split `TelegramBotAdapter` into command handlers
- Inject dependencies via constructor

### Step 7: Composition Root
- Create `composition-root.ts`
- Replace `index.ts` with composition root

### Step 8: Remove Singletons
- Replace all `getInstance()` with constructor injection
- Update all call sites

---

## Testing Strategy

| Layer | Test Type | Tools |
|-------|-----------|-------|
| Domain | Unit (pure functions) | Vitest |
| Infrastructure | Integration (with real deps) | Vitest + testcontainers |
| Application | Unit (mocked deps) | Vitest |
| Workers | E2E (real worker) | Vitest |
| Adapters | Unit (mocked deps) | Vitest |

---

## Benefits After Refactor

1. **Testable**: Every class can be unit tested with mocked dependencies
2. **Maintainable**: Clear separation of concerns
3. **Extensible**: Easy to add new client types, storage backends, transports
4. **Swappable**: Can replace mtcute with another Telegram library
5. **Debuggable**: Explicit dependency graph
6. **Scalable**: Workers can be independently scaled
7. **Type-Safe**: Full TypeScript coverage with interfaces

---

## Files to Create/Modify

### New Files (~25)
- `core/interfaces/*.ts` (5 files)
- `core/domain/*.ts` (4 files)
- `core/infrastructure/*.ts` (4 files)
- `core/application/*.ts` (3 files)
- `workers/hypervisor-worker.ts`
- `adapters/telegram/command-handlers/*.ts` (3 files)
- `adapters/telegram/import-handler.ts`
- `composition-root.ts`

### Modified Files (~10)
- `core/hypervisor.ts` → implement `IClientManager`
- `core/isolated.telegram.ts` → split into domain + infrastructure
- `core/hypervisor.layer.ts` → implement `IRpcClient`
- `core/worker.rpc.ts` → implement `IRpcClient`/`IRpcHost`
- `adapters/telegram/adapter.ts` → split into handlers
- `workers/hypervisor.ts` → thin entry point
- `index.ts` → use composition root

### Deleted Files
- None (gradual migration)

---

## Estimated Effort

| Phase | Effort | Risk |
|-------|--------|------|
| 1: Interfaces | Low | Low |
| 2: Domain | Medium | Low |
| 3: Infrastructure | Medium | Medium |
| 4: Application | Medium | Low |
| 5: Workers | Low | Low |
| 6: Adapters | Medium | Medium |
| 7: Composition Root | Low | Low |
| 8: Migration | High | Medium |

**Total**: ~2-3 weeks for full migration with tests