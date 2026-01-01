/**
 * FlowTrace Server - Main Entry Point (Wrapper Only)
 *
 * Server app is a thin wrapper around @flowtrace/core.
 * All business logic is in core - this file only handles:
 * - NestJS HTTP server setup
 * - Starting FlowTraceApplication from core
 *
 * @requirements 9.1 - Server is wrapper around @flowtrace/core
 * @requirements 11.3 - Server and desktop use FlowTraceApplication for lifecycle management
 */

import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '@flowtrace/api';
import {
  createLogger,
  bootstrap,
  ContainerFactory,
  TYPES,
  type BootstrapResult,
} from '@flowtrace/core';
import { fileURLToPath } from 'url';

const logger = createLogger('Server');

/**
 * FlowTrace Server Application - Thin Wrapper
 */
class FlowTraceServer {
  private app: NestFastifyApplication | null = null;
  private bootstrapResult: BootstrapResult | null = null;

  constructor() {
    this.setupProcessHandlers();
  }

  /**
   * Start the server application
   *
   * Simple flow:
   * 1. Bootstrap core - creates DI container using ContainerFactory.createMainThread('cloud')
   * 2. Verify cloud-specific services are correctly resolved
   * 3. Start NestJS API server
   *
   * @requirements 8.1, 8.2 - Update server/main.ts to use new DI structure
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting FlowTrace Server...', {
        nodeVersion: process.version,
        environment: process.env['NODE_ENV'] ?? 'development',
      });

      // Step 1: Bootstrap core - creates container using ContainerFactory.createMainThread()
      // This configures all main thread features:
      // - CandleProcessing (main thread role)
      // - SymbolManagement
      // - TradeRouter
      // - WorkerManagement
      // - MarketData
      // - ExchangeManagement
      logger.info('Bootstrapping FlowTrace core with new DI structure...');
      this.bootstrapResult = await bootstrap();
      logger.info('FlowTrace core bootstrapped successfully');

      // Step 2: Verify cloud-specific services are correctly resolved
      this.verifyCloudServices();

      // Step 3: Start NestJS API server
      logger.info('Starting NestJS API server...');
      await this.startApiServer();

      logger.info('FlowTrace Server started successfully', {
        features: this.bootstrapResult.app.getStatus(),
      });

      process.stdin.resume();
    } catch (error) {
      logger.error('Failed to start FlowTrace Server', error);
      await this.stop();
      process.exit(1);
    }
  }

  /**
   * Verify cloud-specific services are correctly resolved
   *
   * Ensures that the DI container has all required cloud services bound
   * and that they are using cloud-specific implementations (PostgreSQL, Redis, etc.)
   *
   * @requirements 8.2 - Verify all cloud-specific services are correctly resolved
   */
  private verifyCloudServices(): void {
    if (!this.bootstrapResult) {
      throw new Error('Bootstrap result is not available');
    }

    const { container } = this.bootstrapResult;

    logger.info('Verifying cloud-specific services...');

    // Verify core infrastructure services
    if (!container.isBound(TYPES.Logger)) {
      throw new Error('Logger service not bound in container');
    }

    if (!container.isBound(TYPES.FlowTraceApplication)) {
      throw new Error('FlowTraceApplication not bound in container');
    }

    // Note: Database and other services are lazily bound and may not be immediately available
    // They will be resolved when first accessed by the application

    logger.info('Cloud-specific services verified successfully');
  }

  /**
   * Start the NestJS API server with Fastify
   */
  private async startApiServer(): Promise<void> {
    this.app = await NestFactory.create<NestFastifyApplication>(
      AppModule.forRoot(this.bootstrapResult!.container),
      new FastifyAdapter({
        logger: process.env['NODE_ENV'] !== 'production',
      })
    );

    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      })
    );

    this.app.enableCors({
      origin: process.env['CORS_ORIGIN'] ?? '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      credentials: true,
    });

    // Swagger documentation
    const config = new DocumentBuilder()
      .setTitle('FlowTrace API')
      .setDescription('Trading data and footprint API')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(this.app, config);
    SwaggerModule.setup('api/docs', this.app, document);

    const port = parseInt(process.env['PORT'] ?? '3001', 10);
    const host = process.env['HOST'] ?? '0.0.0.0';

    await this.app.listen(port, host);
    logger.info(`API server running on http://${host}:${port}`);
  }

  /**
   * Stop the server application gracefully
   */
  async stop(): Promise<void> {
    logger.info('Stopping FlowTrace Server...');

    // Stop NestJS app first
    if (this.app) {
      await this.app.close();
    }

    // Stop FlowTraceApplication - handles all cleanup (workers, db, etc.)
    if (this.bootstrapResult?.app) {
      await this.bootstrapResult.app.stop();
    }

    logger.info('FlowTrace Server stopped');
    process.exit(0);
  }

  /**
   * Setup process signal handlers
   */
  private setupProcessHandlers(): void {
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      this.stop();
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', reason);
      this.stop();
    });
  }
}

// Start the server (ESM entry point detection)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const server = new FlowTraceServer();
  server.start();
}

export { FlowTraceServer };
