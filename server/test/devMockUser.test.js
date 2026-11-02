import test from 'node:test';
import assert from 'node:assert';

process.env.SUPABASE_URL ||= 'https://x.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'dummy';
process.env.NODE_ENV = 'development';

const { authMiddleware } = await import('../src/middleware/auth.js');

function respond() {
  const res = {};
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
}

test('dev mock user is opt-in: no flag -> 401, flag -> mock uid', async () => {
  delete process.env.ALLOW_DEV_MOCK_USER;
  let nexted = false;
  const res = respond();
  await authMiddleware({ headers: {} }, res, () => (nexted = true));
  assert.strictEqual(nexted, false, 'must not continue without the flag');
  assert.strictEqual(res.statusCode, 401);

  process.env.ALLOW_DEV_MOCK_USER = 'true';
  const req = { headers: {} };
  await authMiddleware(req, respond(), () => (nexted = true));
  assert.strictEqual(nexted, true);
  assert.strictEqual(req.user.id, '00000000-0000-0000-0000-000000000001');
  delete process.env.ALLOW_DEV_MOCK_USER;
});
