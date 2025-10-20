import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../errors/index.js';

/**
 * SQLite error codes mapping to HTTP status codes
 */
const SQLITE_ERROR_MAP: Record<string, number> = {
  SQLITE_CONSTRAINT_UNIQUE: 409, // Conflict - unique constraint violation
  SQLITE_CONSTRAINT_FOREIGNKEY: 400, // Bad Request - foreign key constraint
  SQLITE_BUSY: 503, // Service Unavailable - database locked
  SQLITE_LOCKED: 503, // Service Unavailable - database locked
  SQLITE_READONLY: 503, // Service Unavailable - read-only database
  SQLITE_IOERR: 500, // Internal Server Error - I/O error
  SQLITE_CORRUPT: 500, // Internal Server Error - database corrupted
  SQLITE_FULL: 507, // Insufficient Storage
  SQLITE_CANTOPEN: 500, // Internal Server Error - cannot open DB
};

/**
 * Global error handler for Fastify
 * Handles Zod validation errors, SQLite errors, and custom AppError instances
 */
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { log } = request;

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    log.warn({ error: error.errors, path: request.url }, 'Validation error');
    return reply.status(400).send({
      error: 'Validation Error',
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    });
  }

  // Handle custom AppError instances
  if (error instanceof AppError) {
    const statusCode = error.statusCode;

    // Log only server errors (5xx) with stack trace
    if (statusCode >= 500) {
      log.error({ error, path: request.url }, error.message);
    } else {
      log.warn({ error: error.message, code: error.code, path: request.url }, error.message);
    }

    return reply.status(statusCode).send({
      error: error.name,
      code: error.code,
      message: error.message,
      ...(statusCode >= 500 &&
        process.env.NODE_ENV !== 'production' && {
          stack: error.stack,
        }),
    });
  }

  // Handle SQLite errors (error message contains SQLite error code)
  const sqliteErrorCode = Object.keys(SQLITE_ERROR_MAP).find(code =>
    error.message?.includes(code)
  );
  if (sqliteErrorCode) {
    const statusCode = SQLITE_ERROR_MAP[sqliteErrorCode];
    log.error({ error, path: request.url }, `SQLite error: ${sqliteErrorCode}`);

    return reply.status(statusCode).send({
      error: 'Database Error',
      code: sqliteErrorCode,
      message: getSQLiteErrorMessage(sqliteErrorCode),
      ...(statusCode >= 500 &&
        process.env.NODE_ENV !== 'production' && {
          details: error.message,
        }),
    });
  }

  // Handle Fastify validation errors
  if (error.validation) {
    log.warn({ error: error.validation, path: request.url }, 'Fastify validation error');
    return reply.status(400).send({
      error: 'Validation Error',
      code: 'VALIDATION_ERROR',
      message: error.message,
      details: error.validation,
    });
  }

  // Handle all other errors as 500 Internal Server Error
  const statusCode = error.statusCode ?? 500;
  log.error({ error, path: request.url }, error.message ?? 'Internal Server Error');

  return reply.status(statusCode).send({
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : error.message,
    ...(process.env.NODE_ENV !== 'production' && {
      stack: error.stack,
    }),
  });
}

/**
 * Get user-friendly error message for SQLite error codes
 */
function getSQLiteErrorMessage(code: string): string {
  switch (code) {
    case 'SQLITE_CONSTRAINT_UNIQUE':
      return 'A record with this value already exists';
    case 'SQLITE_CONSTRAINT_FOREIGNKEY':
      return 'Referenced record does not exist';
    case 'SQLITE_BUSY':
    case 'SQLITE_LOCKED':
      return 'Database is currently busy, please try again';
    case 'SQLITE_READONLY':
      return 'Database is in read-only mode';
    case 'SQLITE_FULL':
      return 'Database storage is full';
    case 'SQLITE_IOERR':
      return 'Database I/O error occurred';
    case 'SQLITE_CORRUPT':
      return 'Database file is corrupted';
    case 'SQLITE_CANTOPEN':
      return 'Cannot open database file';
    default:
      return 'Database error occurred';
  }
}
