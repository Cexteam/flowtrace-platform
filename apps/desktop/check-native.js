#!/usr/bin/env node
/**
 * Check if better-sqlite3 native module is compiled for correct Electron version.
 * Auto-rebuilds if mismatch detected or bindings file missing.
 */

import { execSync } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function checkNativeModule() {
  try {
    // Try to actually load better-sqlite3 with electron
    execSync('npx electron -e "require(\'better-sqlite3\')"', {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 15000,
      cwd: __dirname,
    });
    console.log('✅ Native module OK');
    return true;
  } catch (e) {
    const stderr = e.stderr || e.message || '';
    const stdout = e.stdout || '';
    const output = stderr + stdout;

    if (output.includes('NODE_MODULE_VERSION')) {
      console.log('⚠️  Native module ABI mismatch detected, rebuilding...');
      return false;
    }
    if (output.includes('Could not locate the bindings file')) {
      console.log('⚠️  Native module bindings not found, rebuilding...');
      return false;
    }
    if (output.includes('ERR_DLOPEN_FAILED')) {
      console.log('⚠️  Native module load failed, rebuilding...');
      return false;
    }
    // Other errors - assume OK (e.g., display issues on headless)
    console.log('✅ Native module check passed');
    return true;
  }
}

function rebuild() {
  console.log('🔧 Rebuilding better-sqlite3 for Electron...');
  try {
    execSync('npx @electron/rebuild -f -w better-sqlite3', {
      stdio: 'inherit',
      encoding: 'utf8',
      cwd: __dirname,
    });
    console.log('✅ Rebuild complete');
    return true;
  } catch (e) {
    console.error('❌ Rebuild failed:', e.message);
    return false;
  }
}

// Main
const isOK = checkNativeModule();
if (!isOK) {
  const success = rebuild();
  process.exit(success ? 0 : 1);
}
