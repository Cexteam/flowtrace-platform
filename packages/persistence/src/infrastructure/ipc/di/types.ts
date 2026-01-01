/**
 * IPC DI Types
 * Separated from module.ts to avoid circular dependency.
 */

// =============================================================================
// DI Types
// =============================================================================

export const IPC_TYPES = {
  RuntimeDatabase: Symbol.for('RuntimeDatabase'),
  UnixSocketServer: Symbol.for('UnixSocketServer'),
  RuntimeDatabasePoller: Symbol.for('RuntimeDatabasePoller'),
  UnixSocketPath: Symbol.for('UnixSocketPath'),
  RuntimeDbPath: Symbol.for('RuntimeDbPath'),
  PollerConfig: Symbol.for('PollerConfig'),
  MessageRouter: Symbol.for('MessageRouter'),
} as const;

/**
 * DI tokens for MessageRouter handler injection
 */
export const MESSAGE_ROUTER_TYPES = {
  CandleHandler: Symbol.for('MessageRouter.CandleHandler'),
  StateHandler: Symbol.for('MessageRouter.StateHandler'),
  GapHandler: Symbol.for('MessageRouter.GapHandler'),
} as const;
