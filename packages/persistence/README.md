# @flowtrace/persistence

Candle persistence service with bootstrap pattern for FlowTrace platform.

## Overview

`@flowtrace/persistence` is a standalone package that provides reliable storage for completed candles. It follows hexagonal architecture and uses the bootstrap pattern for initialization.

## Features

- **Bootstrap Pattern**: Unified initialization for all deployments
- **Hexagonal Architecture**: Clean separation of domain, application, and infrastructure
- **Dual Consumer**: Consumes from both Unix Socket (real-time) and SQLite Queue (backup)
- **Binary Storage**: Efficient .ftcd file format for candle data
- **Data Validation**: Comprehensive validation of candle data integrity
- **Health Checks**: HTTP endpoints for orchestration systems
- **Subpath Exports**: Tree-shakeable imports for optimal bundle size

## Installation

```bash
pnpm add @flowtrace/persistence
```

## Available Imports

The package provides multiple entry points for optimal tree-shaking:

| Import Path                                         | Description                                            |
| --------------------------------------------------- | ------------------------------------------------------ |
| `@flowtrace/persistence`                            | Bootstrap, core application, and DI container          |
| `@flowtrace/persistence/features/candlePersistence` | Candle persistence feature (services, ports, adapters) |
| `@flowtrace/persistence/shared/storage`             | Storage infrastructure (serialization, SQLite, file)   |
| `@flowtrace/persistence/shared/migration`           | Migration tools (migrator, validator, reporter)        |
| `@flowtrace/persistence/shared/di`                  | DI container utilities                                 |

## Usage

### Basic Usage (Bootstrap)

```typescript
import { bootstrap } from '@flowtrace/persistence';

async function main() {
  const { app: persistenceApp } = await bootstrap({
    socketPath: '/tmp/flowtrace.sock',
    queuePath: '/data/queue/queue.db',
    storage: {
      baseDir: '/data/candles',
    },
    healthCheckPort: 3001,
  });

  await persistenceApp.start();

  process.on('SIGTERM', async () => {
    await persistenceApp.stop();
    process.exit(0);
  });
}

main();
```

### Electron Desktop Usage

```typescript
import { bootstrap } from '@flowtrace/persistence';
import { app } from 'electron';
import * as path from 'path';

async function main() {
  const { app: persistenceApp } = await bootstrap({
    socketPath: path.join(app.getPath('userData'), 'flowtrace.sock'),
    queuePath: path.join(app.getPath('userData'), 'queue.db'),
    storage: {
      baseDir: path.join(app.getPath('userData'), 'candles'),
    },
  });

  await persistenceApp.start();

  process.on('SIGTERM', async () => {
    await persistenceApp.stop();
    process.exit(0);
  });
}

main();
```

### Feature-Specific Imports (Recommended for Tree-Shaking)

```typescript
// Candle persistence feature
import {
  CandlePersistenceService,
  CandleValidator,
  BinaryStorageAdapter,
  SQLiteFlatBufferStorage,
} from '@flowtrace/persistence/features/candlePersistence';

import type {
  CandlePersistencePort,
  CandleStoragePort,
  PersistCandleRequest,
} from '@flowtrace/persistence/features/candlePersistence';
```

### Storage Infrastructure

```typescript
// Binary and FlatBuffer serialization
import {
  BinarySerializer,
  FlatBufferSerializer,
  CandleTransformer,
  StorageOrganizer,
} from '@flowtrace/persistence/shared/storage';

import type {
  BinaryCandle,
  BinaryStorageConfig,
  StorageOrganizationConfig,
} from '@flowtrace/persistence/shared/storage';
```

### Migration Tools

```typescript
// Migration infrastructure
import {
  StorageMigrator,
  MigrationValidator,
  MigrationReporter,
} from '@flowtrace/persistence/shared/migration';

import type {
  MigrationConfig,
  MigrationProgress,
  MigrationResult,
} from '@flowtrace/persistence/shared/migration';
```

### DI Container Utilities

```typescript
// DI container setup
import {
  ContainerFactory,
  ContainerValidator,
  PERSISTENCE_TYPES,
  CANDLE_PERSISTENCE_TYPES,
  registerAllBindings,
} from '@flowtrace/persistence/shared/di';
```

## Architecture

### Package Structure

```
src/
├── bootstrap.ts                    # Bootstrap function and config
├── index.ts                        # Public exports
├── features/
│   └── candlePersistence/
│       ├── domain/
│       │   └── validation/
│       │       └── CandleValidator.ts
│       ├── application/
│       │   ├── ports/
│       │   │   ├── in/
│       │   │   │   └── CandlePersistencePort.ts
│       │   │   └── out/
│       │   │       └── CandleStoragePort.ts
│       │   ├── services/
│       │   │   └── CandlePersistenceService.ts
│       │   └── use-cases/
│       │       └── PersistCandle/
│       │           ├── PersistCandleUseCase.ts
│       │           ├── DTO.ts
│       │           └── index.ts
│       └── infrastructure/
│           └── adapters/
│               └── BinaryStorageAdapter.ts
└── shared/
    ├── application/
    │   └── PersistenceApplication.ts
    ├── infrastructure/
    │   ├── consumer/
    │   │   └── MessageConsumer.ts
    │   ├── health/
    │   │   └── HealthCheckServer.ts
    │   └── storage/
    │       ├── serialization/
    │       │   ├── binary/
    │       │   └── flatbuffer/
    │       ├── sqlite/
    │       │   ├── connection/
    │       │   ├── schema/
    │       │   ├── index/
    │       │   └── query/
    │       ├── file/
    │       └── cache/
    └── lib/di/
        ├── core/
        │   ├── types.ts
        │   ├── ContainerFactory.ts
        │   └── validation.ts
        └── bindings/
            ├── core/
            │   ├── logger/
            │   ├── ipc/
            │   └── config/
            └── features/
                └── candlePersistence/
```

### Dependencies

- `@flowtrace/core`: Domain entities (FootprintCandle)
- `@flowtrace/ipc`: IPC infrastructure (UnixSocket, SQLiteQueue)
- `inversify`: Dependency injection
- `zod`: Schema validation

## Configuration

### PersistenceBootstrapConfig

```typescript
interface PersistenceBootstrapConfig {
  socketPath: string;
  queuePath: string;
  storage: {
    baseDir: string;
    useDatabase?: boolean; // Use SQLite (true) or binary files (false)
    organizeByExchange?: boolean; // Organize databases by exchange
    maxCandlesPerBlock?: number;
    walMode?: boolean; // Enable WAL mode for SQLite
    cacheSize?: number; // Cache size in KB
    mmapSize?: number; // Memory-mapped I/O size
  };
  healthCheckPort?: number;
  pollInterval?: number;
  batchSize?: number;
  validation?: {
    enabled: boolean;
    strictMode: boolean;
    maxErrorRate: number;
    alertThreshold: number;
  };
}
```

## Development

### Build

```bash
pnpm build
```

### Test

```bash
pnpm test
```

### Lint

```bash
pnpm lint
```

## License

ISC
