/**
 * Bootstrap function for @flowtrace/api
 *
 * Provides a clean initialization API for both HTTP server and application context modes.
 * Centralizes all NestJS configuration (Fastify, validation, CORS, Swagger) in one place.
 *
 * Works with the unified SQLite architecture - all deployments (desktop, server) use
 * the same container configuration from @flowtrace/core.
 *
 * @example Server mode
 * ```typescript
 * const { app, url } = await bootstrap(container, {
 *   mode: 'server',
 *   port: 3001,
 *   host: '0.0.0.0'
 * });
 * ```
 *
 * @example Context mode (for desktop/CLI)
 * ```typescript
 * const { app } = await bootstrap(container, {
 *   mode: 'context'
 * });
 * ```
 */

import { ValidationPipe } from '@nestjs/common';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Container } from 'inversify';
import { AppModule } from './app.module.js';
import {
  BootstrapError,
  BootstrapErrorCodes,
  type BootstrapOptions,
  type BootstrapResult,
  type ContextBootstrapOptions,
  type ServerBootstrapOptions,
} from './bootstrap.types.js';

/**
 * Configure global validation pipes for the application
 *
 * Sets up class-validator with:
 * - whitelist: Strip properties that don't have decorators
 * - transform: Automatically transform payloads to DTO instances
 * - enableImplicitConversion: Convert primitive types automatically
 *
 * Note: Only applies to NestFastifyApplication (server mode).
 * Context mode doesn't support global pipes.
 *
 * @internal
 */
function configureValidation(app: NestFastifyApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );
}

/**
 * Configure CORS (Cross-Origin Resource Sharing) for the HTTP server
 *
 * Enables CORS unless explicitly disabled via options.
 * Supports custom origin configuration.
 *
 * @internal
 */
function configureCors(
  app: NestFastifyApplication,
  options: ServerBootstrapOptions
): void {
  if (options.enableCors !== false) {
    app.enableCors({
      origin: options.corsOrigin ?? '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      credentials: true,
    });
  }
}

/**
 * Configure Swagger/OpenAPI documentation for the HTTP server
 *
 * Sets up Swagger UI at /api/docs unless explicitly disabled.
 * Includes API metadata and tags for all feature modules.
 *
 * @internal
 */
function configureSwagger(
  app: NestFastifyApplication,
  options: ServerBootstrapOptions
): void {
  if (options.enableSwagger !== false) {
    const config = new DocumentBuilder()
      .setTitle('FlowTrace API')
      .setDescription(
        'Trading data and footprint API for real-time market analysis'
      )
      .setVersion('1.0')
      .addTag('candles', 'Candle data endpoints')
      .addTag('footprint', 'Footprint analysis endpoints')
      .addTag('symbols', 'Symbol management endpoints')
      .addTag('exchanges', 'Exchange configuration endpoints')
      .addTag('workers', 'Worker management endpoints')
      .addTag('data-quality', 'Data quality monitoring endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }
}

/**
 * Validate the Inversify container before bootstrapping
 *
 * Ensures the container is not null/undefined and is a valid Container instance.
 * Throws BootstrapError if validation fails.
 *
 * @internal
 */
function validateContainer(container: Container): void {
  if (!container) {
    throw new BootstrapError(
      'Container is required for bootstrap. Received: ' +
        (container === null ? 'null' : 'undefined'),
      BootstrapErrorCodes.INVALID_CONTAINER
    );
  }

  // Check if it's a valid Inversify Container instance
  if (typeof container !== 'object' || !('get' in container)) {
    throw new BootstrapError(
      'Invalid container provided. Expected an Inversify Container instance.',
      BootstrapErrorCodes.INVALID_CONTAINER
    );
  }
}

/**
 * Validate server bootstrap options
 *
 * Ensures port and host are valid values.
 * Throws BootstrapError if validation fails.
 *
 * @internal
 */
function validateServerOptions(options: ServerBootstrapOptions): void {
  if (options.port !== undefined) {
    if (
      typeof options.port !== 'number' ||
      options.port < 0 ||
      options.port > 65535
    ) {
      throw new BootstrapError(
        `Invalid port number: ${options.port}. Port must be between 0 and 65535.`,
        BootstrapErrorCodes.INVALID_OPTIONS
      );
    }
  }

  if (options.host !== undefined && typeof options.host !== 'string') {
    throw new BootstrapError(
      `Invalid host: ${options.host}. Host must be a string.`,
      BootstrapErrorCodes.INVALID_OPTIONS
    );
  }
}

/**
 * Bootstrap NestJS application in server mode (with HTTP server)
 *
 * Creates a NestJS application with Fastify adapter and configures:
 * - Global validation pipes
 * - CORS (if enabled)
 * - Swagger documentation (if enabled)
 *
 * @internal
 */
async function bootstrapServer(
  container: Container,
  options: ServerBootstrapOptions
): Promise<BootstrapResult> {
  try {
    // Validate options
    validateServerOptions(options);

    // Create Fastify adapter with optional logging
    const adapter = new FastifyAdapter({
      logger: !options.silent,
    });

    // Create NestJS application with Fastify
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule.forRoot(container, {
        candleReader: options.candleReader,
        gapReader: options.gapReader,
      }),
      adapter,
      {
        logger: options.silent ? false : ['error', 'warn', 'log'],
      }
    );

    // Configure validation
    configureValidation(app);

    // Configure CORS
    configureCors(app, options);

    // Configure Swagger
    configureSwagger(app, options);

    // Start listening
    const port = options.port ?? 3001;
    const host = options.host ?? '0.0.0.0';
    await app.listen(port, host);

    const url = `http://${host}:${port}`;

    // Log startup messages (unless silent)
    if (!options.silent) {
      console.log(`FlowTrace API running on ${url}`);
      if (options.enableSwagger !== false) {
        console.log(`Swagger docs available at ${url}/api/docs`);
      }
    }

    return {
      mode: 'server',
      app,
      url,
      close: async () => {
        try {
          await app.close();
        } catch (error) {
          throw new BootstrapError(
            'Failed to shut down server',
            BootstrapErrorCodes.SHUTDOWN_FAILED,
            error as Error
          );
        }
      },
    };
  } catch (error) {
    // Handle specific error cases
    if (error instanceof BootstrapError) {
      throw error;
    }

    if (error instanceof Error) {
      // Port already in use
      if (error.message.includes('EADDRINUSE')) {
        throw new BootstrapError(
          `Port ${options.port ?? 3001} is already in use`,
          BootstrapErrorCodes.PORT_IN_USE,
          error
        );
      }

      // Generic initialization failure
      throw new BootstrapError(
        'Failed to initialize NestJS application in server mode',
        BootstrapErrorCodes.INITIALIZATION_FAILED,
        error
      );
    }

    // Unknown error type
    throw new BootstrapError(
      'An unexpected error occurred during bootstrap',
      BootstrapErrorCodes.INITIALIZATION_FAILED
    );
  }
}

/**
 * Bootstrap NestJS application in context mode (without HTTP server)
 *
 * Creates a NestJS application context for use in desktop apps or CLI tools.
 * Does not configure global pipes (not supported in context mode).
 *
 * @internal
 */
async function bootstrapContext(
  container: Container,
  options: ContextBootstrapOptions
): Promise<BootstrapResult> {
  try {
    // Create application context (no HTTP server)
    const app = await NestFactory.createApplicationContext(
      AppModule.forRoot(container, {
        candleReader: options.candleReader,
        gapReader: options.gapReader,
      }),
      {
        logger: options.silent ? false : ['error', 'warn'],
      }
    );

    // Note: Global pipes are not supported in application context mode
    // Validation will be handled at the controller/service level if needed

    return {
      mode: 'context',
      app,
      close: async () => {
        try {
          await app.close();
        } catch (error) {
          throw new BootstrapError(
            'Failed to shut down application context',
            BootstrapErrorCodes.SHUTDOWN_FAILED,
            error as Error
          );
        }
      },
    };
  } catch (error) {
    // Handle specific error cases
    if (error instanceof BootstrapError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new BootstrapError(
        'Failed to initialize NestJS application in context mode',
        BootstrapErrorCodes.INITIALIZATION_FAILED,
        error
      );
    }

    // Unknown error type
    throw new BootstrapError(
      'An unexpected error occurred during bootstrap',
      BootstrapErrorCodes.INITIALIZATION_FAILED
    );
  }
}

/**
 * Bootstrap the FlowTrace API application
 *
 * Initializes a NestJS application in either server mode (with HTTP server)
 * or context mode (without HTTP server, for desktop/CLI apps).
 *
 * All NestJS configuration is handled internally:
 * - Fastify adapter (server mode only)
 * - Global validation pipes
 * - CORS (server mode, if enabled)
 * - Swagger documentation (server mode, if enabled)
 *
 * @param container - Inversify container from @flowtrace/core
 * @param options - Bootstrap options (mode-specific)
 * @returns Bootstrap result with configured NestJS instance
 * @throws {BootstrapError} If container is invalid or initialization fails
 *
 * @example Server mode
 * ```typescript
 * import { bootstrap } from '@flowtrace/core';
 * import { bootstrap as bootstrapApi } from '@flowtrace/api';
 *
 * // Unified architecture - no platform parameter needed
 * const { container } = await bootstrap();
 * const { app, url } = await bootstrapApi(container, {
 *   mode: 'server',
 *   port: 3001,
 *   host: '0.0.0.0'
 * });
 * console.log(`Server running on ${url}`);
 * ```
 *
 * @example Context mode (desktop app)
 * ```typescript
 * import { bootstrap } from '@flowtrace/core';
 * import { bootstrap as bootstrapApi } from '@flowtrace/api';
 *
 * // Unified architecture - same bootstrap for all deployments
 * const { container } = await bootstrap();
 * const { app } = await bootstrapApi(container, {
 *   mode: 'context'
 * });
 *
 * // Use services via dependency injection
 * const symbolsService = app.get(SymbolsService);
 * ```
 *
 * @example Silent mode (for testing)
 * ```typescript
 * const { app } = await bootstrap(testContainer, {
 *   mode: 'context',
 *   silent: true
 * });
 * ```
 */
export async function bootstrap(
  container: Container,
  options: BootstrapOptions
): Promise<BootstrapResult> {
  // Validate container before proceeding
  validateContainer(container);

  // Route to appropriate bootstrap function based on mode
  if (options.mode === 'server') {
    return bootstrapServer(container, options);
  } else {
    return bootstrapContext(container, options);
  }
}
