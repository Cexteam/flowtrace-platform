/**
 * UIContainerFactory - Creates platform-appropriate DI containers for UI
 *
 * Factory class that creates containers with bindings configured for
 * the specific platform (cloud or desktop).
 *
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import { UIPlatformType, UIContainerConfig, UI_CORE_TYPES } from './types';

// Singleton container cache
let containerInstance: Container | null = null;
let currentPlatform: UIPlatformType | null = null;

/**
 * Detect platform from environment
 * In browser: check for Electron IPC bridge
 * In SSR: check environment variable
 */
function detectPlatform(): UIPlatformType {
  // Server-side detection
  if (typeof window === 'undefined') {
    const mode = process.env.FLOWTRACE_MODE?.toLowerCase();
    return mode === 'desktop' ? 'desktop' : 'cloud';
  }

  // Client-side detection - check for Electron IPC bridge
  // Note: preload.ts exposes API as 'electron', not 'electronAPI'
  if (typeof window !== 'undefined' && 'electron' in window) {
    return 'desktop';
  }

  return 'cloud';
}

/**
 * Get API base URL from environment
 */
function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  // Client-side: use window location or env variable
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/api`
      : 'http://localhost:3001')
  );
}

/**
 * UIContainerFactory - Static factory for creating UI DI containers
 *
 * Provides centralized container creation with platform-specific bindings.
 * Implements singleton pattern for the container.
 */
export class UIContainerFactory {
  /**
   * Create or get the UI DI container
   *
   * @param config - Optional configuration. If not provided, auto-detects platform.
   * @returns Configured InversifyJS container
   *
   * @example
   * // Auto-detect platform
   * const container = UIContainerFactory.create();
   *
   * @example
   * // Explicit platform for testing
   * const container = UIContainerFactory.create({ platform: 'desktop' });
   *
   */
  static create(config?: Partial<UIContainerConfig>): Container {
    const platform = config?.platform ?? detectPlatform();
    const apiBaseUrl = config?.apiBaseUrl ?? getApiBaseUrl();

    // Return cached container if platform matches
    if (containerInstance && currentPlatform === platform) {
      return containerInstance;
    }

    // Create new container
    const container = new Container();

    // Bind core configuration
    container
      .bind<UIPlatformType>(UI_CORE_TYPES.PlatformType)
      .toConstantValue(platform);
    container
      .bind<string>(UI_CORE_TYPES.ApiBaseUrl)
      .toConstantValue(apiBaseUrl);
    container
      .bind<UIContainerConfig>(UI_CORE_TYPES.ContainerConfig)
      .toConstantValue({
        platform,
        apiBaseUrl,
      });

    // Cache the container
    containerInstance = container;
    currentPlatform = platform;

    return container;
  }

  /**
   * Get the current platform type
   */
  static getPlatformType(): UIPlatformType {
    return currentPlatform ?? detectPlatform();
  }

  /**
   * Check if running in desktop mode
   */
  static isDesktop(): boolean {
    return UIContainerFactory.getPlatformType() === 'desktop';
  }

  /**
   * Check if running in cloud mode
   */
  static isCloud(): boolean {
    return UIContainerFactory.getPlatformType() === 'cloud';
  }

  /**
   * Reset the container (useful for testing)
   */
  static reset(): void {
    containerInstance = null;
    currentPlatform = null;
  }

  /**
   * Get the current container instance
   * Creates one if it doesn't exist
   */
  static getContainer(): Container {
    if (!containerInstance) {
      return UIContainerFactory.create();
    }
    return containerInstance;
  }
}

// Export convenience functions
export const createUIContainer = UIContainerFactory.create;
export const getUIContainer = UIContainerFactory.getContainer;
