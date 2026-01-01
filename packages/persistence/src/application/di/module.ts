/**
 * Application DI Module
 * DI module for application layer components.
 */

import { Container } from 'inversify';
import { PersistenceApplication } from '../PersistenceApplication.js';

// =============================================================================
// DI Types
// =============================================================================

export const APPLICATION_TYPES = {
  PersistenceApplication: Symbol.for('PersistenceApplication'),
} as const;

// =============================================================================
// Binding Registration
// =============================================================================

export function registerApplicationBindings(container: Container): void {
  container
    .bind<PersistenceApplication>(APPLICATION_TYPES.PersistenceApplication)
    .to(PersistenceApplication)
    .inSingletonScope();
}
