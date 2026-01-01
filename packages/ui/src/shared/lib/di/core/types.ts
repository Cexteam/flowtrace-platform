/**
 * UI DI Core Types
 *
 * Defines platform types and container configuration for the UI package.
 * Supports switching between HTTP adapter (Cloud) and IPC adapter (Desktop).
 *
 */

/**
 * Platform type for UI adapter selection
 * - 'cloud': Uses HTTP adapters to call REST API
 * - 'desktop': Uses IPC adapters to call Electron main process
 */
export type UIPlatformType = 'cloud' | 'desktop';

/**
 * Container configuration options
 */
export interface UIContainerConfig {
  platform: UIPlatformType;
  apiBaseUrl?: string; // For HTTP adapters in cloud mode
}

/**
 * Core DI types for UI infrastructure
 */
export const UI_CORE_TYPES = {
  PlatformType: Symbol.for('UI.PlatformType'),
  ApiBaseUrl: Symbol.for('UI.ApiBaseUrl'),
  ContainerConfig: Symbol.for('UI.ContainerConfig'),
} as const;
