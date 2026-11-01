import type { ApiError, ErrorCode } from '@trace/schemas';
import type { FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

/** An expected failure with a status, a stable code for clients and optional details. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue');
export const forbidden = () => new AppError(403, 'FORBIDDEN', 'You are not allowed to do this');

const body = (code: ErrorCode, message: string, details?: unknown): ApiError => ({
  error: details === undefined ? { code, message } : { code, message, details },
});

/** One error shape for every endpoint. Unexpected errors are logged and never reach the client. */
export function registerErrorHandlers(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(body(error.code, error.message, error.details));
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      const issues = error.validation.map((v) => ({ path: v.instancePath, message: v.message }));
      return reply.status(400).send(body('VALIDATION_ERROR', 'The request is invalid', { issues }));
    }
    const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 500;
    if (status >= 400 && status < 500) {
      return reply.status(status).send(body('VALIDATION_ERROR', 'The request is invalid'));
    }
    request.log.error(error);
    return reply.status(500).send(body('INTERNAL_ERROR', 'Something went wrong'));
  });

  app.setNotFoundHandler((_request, reply) => reply.status(404).send(body('NOT_FOUND', 'Route not found')));
}
