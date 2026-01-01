'use client';

import { createContext, useContext, useMemo, ReactNode } from 'react';
import { Container } from 'inversify';
import { UIContainerFactory, UIPlatformType, UIContainerConfig } from './core';

/**
 * Context for the UI DI container
 */
interface UIContainerContextValue {
  container: Container;
  platform: UIPlatformType;
  isDesktop: boolean;
  isCloud: boolean;
}

const UIContainerContext = createContext<UIContainerContextValue | null>(null);

interface UIContainerProviderProps {
  children: ReactNode;
  config?: Partial<UIContainerConfig>;
}

/**
 * Provider component for the UI DI container
 *
 * Wraps the application and provides access to the DI container
 * and platform information throughout the component tree.
 *
 * @requirements 3.2 - UI needs backend data via port out interfaces
 * @requirements 3.4 - Switching between Cloud and Desktop swaps adapters
 *
 * @example
 * // In app layout
 * <UIContainerProvider>
 *   <App />
 * </UIContainerProvider>
 *
 * @example
 * // With explicit platform for testing
 * <UIContainerProvider config={{ platform: 'desktop' }}>
 *   <App />
 * </UIContainerProvider>
 */
export function UIContainerProvider({
  children,
  config,
}: UIContainerProviderProps) {
  const value = useMemo<UIContainerContextValue>(() => {
    const container = UIContainerFactory.create(config);
    const platform = UIContainerFactory.getPlatformType();

    return {
      container,
      platform,
      isDesktop: platform === 'desktop',
      isCloud: platform === 'cloud',
    };
  }, [config]);

  return (
    <UIContainerContext.Provider value={value}>
      {children}
    </UIContainerContext.Provider>
  );
}

/**
 * Hook to access the UI DI container
 *
 * @returns Container context with platform information
 * @throws Error if used outside of UIContainerProvider
 *
 * @example
 * const { container, platform, isDesktop } = useUIContainer();
 * const symbolPort = container.get<SymbolApiPort>(SYMBOL_TYPES.SymbolApiPort);
 */
export function useUIContainer(): UIContainerContextValue {
  const context = useContext(UIContainerContext);

  if (!context) {
    throw new Error('useUIContainer must be used within a UIContainerProvider');
  }

  return context;
}

/**
 * Hook to check current platform
 *
 * @returns Current platform type ('cloud' | 'desktop')
 */
export function usePlatform(): UIPlatformType {
  const { platform } = useUIContainer();
  return platform;
}

/**
 * Hook to check if running in desktop mode
 */
export function useIsDesktop(): boolean {
  const { isDesktop } = useUIContainer();
  return isDesktop;
}

/**
 * Hook to check if running in cloud mode
 */
export function useIsCloud(): boolean {
  const { isCloud } = useUIContainer();
  return isCloud;
}
