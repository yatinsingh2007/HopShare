import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import createApp from '../app.js';
import { HttpError, errorHandler } from '../middleware/errorHandler.js';

const appThrowing = (handler) => {
  const app = express();
  app.get('/x', handler);
  app.use(errorHandler);
  return app;
};

test('GET /api/health → 200 {success:true,data:{status:"ok"}}', async () => {
  const res = await request(createApp()).get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { success: true, data: { status: 'ok' } });
});

test('GET /api/nope → 404 {success:false,message:"Not found"}', async () => {
  const res = await request(createApp()).get('/api/nope');
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { success: false, message: 'Not found' });
});

test('POST /api/health with malformed JSON → 400 "Malformed JSON body"', async () => {
  const res = await request(createApp())
    .post('/api/health')
    .set('Content-Type', 'application/json')
    .send('{bad');
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { success: false, message: 'Malformed JSON body' });
});

test('a route throwing HttpError(418,"teapot") → 418 {success:false,message:"teapot"}', async () => {
  const res = await request(appThrowing(() => { throw new HttpError(418, 'teapot'); })).get('/x');
  assert.equal(res.status, 418);
  assert.deepEqual(res.body, { success: false, message: 'teapot' });
});

test('a route throwing a plain Error → 500 without leaking the message', async () => {
  const res = await request(appThrowing(async () => { throw new Error('secret db detail'); })).get('/x');
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { success: false, message: 'Internal server error' });
});
