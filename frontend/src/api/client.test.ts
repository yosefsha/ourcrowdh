import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../mocks/server';
import { ApiError, get, post } from './client';

describe('get', () => {
  it('resolves with the parsed JSON body on a 2xx response', async () => {
    server.use(http.get('/test/ok', () => HttpResponse.json({ value: 'hello' })));

    await expect(get<{ value: string }>('/test/ok')).resolves.toEqual({ value: 'hello' });
  });

  it('throws an ApiError carrying status 404 and the server message', async () => {
    server.use(
      http.get('/test/missing', () =>
        HttpResponse.json({ message: 'not found' }, { status: 404 }),
      ),
    );

    const error: unknown = await get('/test/missing').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: 'not found' });
  });

  it('throws an ApiError carrying status 409 and the server message', async () => {
    server.use(
      http.get('/test/conflict', () =>
        HttpResponse.json({ message: 'a run is already in progress' }, { status: 409 }),
      ),
    );

    const error: unknown = await get('/test/conflict').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: 'a run is already in progress' });
  });

  it('throws an ApiError carrying status 500 and a fallback message when the body has none', async () => {
    server.use(http.get('/test/boom', () => new HttpResponse(null, { status: 500 })));

    const error: unknown = await get('/test/boom').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 500 });
    expect((error as ApiError).message.length).toBeGreaterThan(0);
  });

  it('joins a ValidationPipe message array into one ApiError message', async () => {
    server.use(
      http.get('/test/invalid', () =>
        HttpResponse.json(
          { message: ['limit must not be less than 1', 'limit must be an integer number'] },
          { status: 400 },
        ),
      ),
    );

    const error: unknown = await get('/test/invalid').catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      status: 400,
      message: 'limit must not be less than 1; limit must be an integer number',
    });
  });

  it('falls back to a status message when the message array is empty', async () => {
    server.use(
      http.get('/test/empty-array', () => HttpResponse.json({ message: [] }, { status: 400 })),
    );

    const error: unknown = await get('/test/empty-array').catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 400 });
    expect((error as ApiError).message.length).toBeGreaterThan(0);
  });
});

describe('post', () => {
  it('sends a JSON body and resolves with the parsed JSON response', async () => {
    server.use(
      http.post('/test/echo', async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json(body, { status: 202 });
      }),
    );

    await expect(post<{ value: string }>('/test/echo', { value: 'hi' })).resolves.toEqual({
      value: 'hi',
    });
  });

  it('throws an ApiError when the server rejects the request', async () => {
    server.use(
      http.post('/test/reject', () =>
        HttpResponse.json({ message: 'nope' }, { status: 409 }),
      ),
    );

    const error: unknown = await post('/test/reject', {}).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: 'nope' });
  });
});
