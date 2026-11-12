import { MAX_PHOTO_BYTES, PHOTO_TYPES } from '@trace/domain';
import type { FastifyError, FastifyInstance } from 'fastify';
import { AppError } from '../errors';

/** Fastify's own errors for a photo upload, in the API's error codes. Anything else goes to the app's handler. */
export function photoUploadError(error: FastifyError): Error {
  if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    return new AppError(413, 'PHOTO_TOO_LARGE', `The photo must be at most ${MAX_PHOTO_BYTES / 1024 / 1024} MB`, {
      maxBytes: MAX_PHOTO_BYTES,
    });
  }
  if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
    return new AppError(415, 'UNSUPPORTED_PHOTO', 'The photo must be a JPEG, PNG or WebP image');
  }
  return error;
}

/**
 * Lets the plugin receive a photo as the raw image bytes, so a phone or browser can send the file as is. Every plugin
 * that takes a photo calls it, because each plugin is encapsulated.
 */
export function acceptPhotoBodies(app: FastifyInstance): void {
  app.addContentTypeParser(
    [...PHOTO_TYPES],
    { parseAs: 'buffer', bodyLimit: MAX_PHOTO_BYTES },
    (_request, body, done) => done(null, body),
  );
}
