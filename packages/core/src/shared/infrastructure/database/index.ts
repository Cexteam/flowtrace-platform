/**
 * Database Infrastructure - Main Barrel Export
 *
 * Exports database connection interfaces, types, adapters, and utilities
 * for SQLite database with IPC-based persistence.
 *
 * This file exports from the refactored structure:
 * - config: Configuration types and resolvers
 * - drizzle: Drizzle ORM implementations
 * - migrations: Migration system and bootstrap utilities
 * - schema: Drizzle schema definitions (SQLite)
 *
 */

// ============================================================================
// Config Layer - Configuration types and resolvers
// ============================================================================
export * from './config/index.js';

// ============================================================================
// Drizzle Layer - Drizzle ORM implementations
// ============================================================================
export * from './drizzle/index.js';

// ============================================================================
// Migrations Layer - Migration system and bootstrap
// ============================================================================
export * from './migrations/index.js';

// ============================================================================
// Schema Exports - SQLite schema
// ============================================================================
export * as sqliteSchema from './schema/sqlite/index.js';
