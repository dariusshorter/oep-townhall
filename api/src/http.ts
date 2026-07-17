import type { HttpResponseInit } from '@azure/functions';

export const json = (body: unknown, status = 200): HttpResponseInit => ({
  status,
  jsonBody: body,
  headers: {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json'
  }
});

export const empty = (status = 204): HttpResponseInit => ({
  status,
  headers: {
    'Cache-Control': 'no-store'
  }
});

export const unauthorized = (): HttpResponseInit => json({ error: 'Unauthorized' }, 403);

export const badRequest = (): HttpResponseInit => json({ error: 'Invalid request' }, 400);

export const serverError = (): HttpResponseInit => json({ error: 'Request failed' }, 500);
