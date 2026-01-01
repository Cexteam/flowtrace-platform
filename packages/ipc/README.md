# @flowtrace/ipc

Shared IPC (Inter-Process Communication) infrastructure for FlowTrace platform.

## Overview

This package provides reliable, high-performance IPC mechanisms for communication between FlowTrace processes:

- **Unix Socket**: Primary channel for sub-millisecond latency communication
- **SQLite Queue**: Fallback channel for persistent message buffering

## Features

- Zero data loss through hybrid IPC (Unix Socket + SQLite Queue)
- Sub-millisecond latency for real-time delivery
- Automatic failover and reconnection
- Message validation with Zod schemas
- No dependencies on other @flowtrace packages

## Installation

```bash
pnpm add @flowtrace/ipc
```

## Import Paths

This package supports subpath exports for tree-shaking and targeted imports:

| Import Path                            | Description                                |
| -------------------------------------- | ------------------------------------------ |
| `@flowtrace/ipc`                       | Core types and backward-compatible exports |
| `@flowtrace/ipc/features/unix-socket`  | Unix Socket client/server                  |
| `@flowtrace/ipc/features/sqlite-queue` | SQLite Queue and Poller                    |

### Recommended: Feature-Specific Imports

```typescript
// Unix Socket feature
import {
  UnixSocketClient,
  UnixSocketServer,
} from '@flowtrace/ipc/features/unix-socket';
import type {
  UnixSocketClientConfig,
  MessageHandler,
} from '@flowtrace/ipc/features/unix-socket';

// SQLite Queue feature
import {
  SQLiteQueue,
  SQLiteQueuePoller,
} from '@flowtrace/ipc/features/sqlite-queue';
import type {
  QueueMessage,
  QueueConfig,
} from '@flowtrace/ipc/features/sqlite-queue';
```

### Legacy: Root Imports (Backward Compatible)

```typescript
// All exports available from root (for backward compatibility)
import {
  UnixSocketClient,
  UnixSocketServer,
  SQLiteQueue,
  SQLiteQueuePoller,
} from '@flowtrace/ipc';

import type { IPCMessage } from '@flowtrace/ipc';
```

## Usage

### Unix Socket Client

```typescript
import { UnixSocketClient } from '@flowtrace/ipc/features/unix-socket';

const client = new UnixSocketClient({
  socketPath: '/tmp/flowtrace.sock',
  connectTimeout: 5000,
});

await client.connect();
await client.send({ type: 'candle:complete', payload: { ... } });
client.disconnect();
```

### Unix Socket Server

```typescript
import { UnixSocketServer } from '@flowtrace/ipc/features/unix-socket';

const server = new UnixSocketServer({
  socketPath: '/tmp/flowtrace.sock',
  maxConnections: 100,
});

server.setMessageHandler(async (message) => {
  console.log('Received:', message);
});

await server.start();
// ... later
await server.stop();
```

### SQLite Queue

```typescript
import { SQLiteQueue } from '@flowtrace/ipc/features/sqlite-queue';

const queue = new SQLiteQueue({
  dbPath: '/path/to/queue.db',
  retentionHours: 24,
});

// Enqueue a message
queue.enqueue({
  id: 'msg-123',
  type: 'candle:complete',
  payload: { ... },
  timestamp: Date.now(),
});

// Dequeue messages
const messages = queue.dequeue(50);

// Mark as processed
queue.markProcessed('msg-123');

// Cleanup old messages
queue.cleanup(24);
```

### SQLite Queue Poller

```typescript
import {
  SQLiteQueuePoller,
  SQLiteQueue,
} from '@flowtrace/ipc/features/sqlite-queue';

const queue = new SQLiteQueue({ dbPath: '/path/to/queue.db' });

const poller = new SQLiteQueuePoller({
  queue,
  pollInterval: 1000,
  batchSize: 50,
  onMessage: async (message) => {
    console.log('Processing:', message);
  },
});

await poller.start();
// ... later
await poller.stop();
```

### Message Validation

```typescript
import { validateQueueMessage } from '@flowtrace/ipc/features/sqlite-queue';

try {
  const message = validateQueueMessage(rawData);
  // message is now typed and validated
} catch (error) {
  // Handle validation error
}
```

## Architecture

### Package Structure

```
packages/ipc/
├── src/
│   ├── index.ts                    # Core exports + backward compatibility
│   ├── features/
│   │   ├── unix-socket/
│   │   │   ├── index.ts            # Feature entry point
│   │   │   ├── domain/
│   │   │   │   └── types.ts
│   │   │   └── infrastructure/
│   │   │       ├── UnixSocketClient.ts
│   │   │       └── UnixSocketServer.ts
│   │   └── sqlite-queue/
│   │       ├── index.ts            # Feature entry point
│   │       ├── domain/
│   │       │   ├── types.ts
│   │       │   ├── schema.ts
│   │       │   └── validation.ts
│   │       └── infrastructure/
│   │           ├── SQLiteQueue.ts
│   │           └── SQLiteQueuePoller.ts
│   └── shared/
│       └── types.ts                # Shared IPCMessage type
└── package.json
```

### Subpath Exports Configuration

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.js"
    },
    "./features/unix-socket": {
      "types": "./dist/features/unix-socket/index.d.ts",
      "require": "./dist/features/unix-socket/index.js"
    },
    "./features/sqlite-queue": {
      "types": "./dist/features/sqlite-queue/index.d.ts",
      "require": "./dist/features/sqlite-queue/index.js"
    }
  }
}
```

### Message Protocol

Unix Socket uses a length-prefix protocol:

```
[4 bytes: message length][N bytes: JSON message]
```

This ensures complete messages are received even when data arrives in chunks.

## Dependencies

- `better-sqlite3`: SQLite database for message queue
- `zod`: Schema validation for messages

## License

ISC
