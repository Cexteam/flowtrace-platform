// Jest setup - load test environment variables
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.test for test environment
config({ path: resolve(__dirname, '.env.test') });
