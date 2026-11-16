import { z } from 'zod';

/** An instant as an ISO 8601 string with a time-zone offset. No OpenAPI id: it stays inline in the document. */
export const IsoDateTime = z.iso.datetime({ offset: true });
