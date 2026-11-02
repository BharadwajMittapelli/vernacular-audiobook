import test from 'node:test';
import assert from 'node:assert';
import { parseAllowedOrigins } from '../src/config/cors.js';

test('FRONTEND_URL allowlist: unset -> dev origin, commas -> trimmed origins, blanks dropped', () => {
  assert.deepStrictEqual(parseAllowedOrigins(undefined), ['http://localhost:5175']);
  assert.deepStrictEqual(parseAllowedOrigins(''), ['http://localhost:5175']);
  assert.deepStrictEqual(parseAllowedOrigins('https://a.vercel.app'), ['https://a.vercel.app']);
  assert.deepStrictEqual(
    parseAllowedOrigins('https://a.vercel.app, https://b.vercel.app ,'),
    ['https://a.vercel.app', 'https://b.vercel.app']
  );
});
