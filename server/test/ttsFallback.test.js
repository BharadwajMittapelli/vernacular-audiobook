import test from 'node:test';
import assert from 'node:assert';
import { isRetryableTtsFailure } from '../src/services/ttsProvider.js';

test('fallback gate: network + 5xx retryable, 4xx + unknown fail hard', () => {
  for (const code of ['ECONNABORTED', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']) {
    assert.strictEqual(isRetryableTtsFailure({ retryableCode: code }), true, code);
  }
  assert.strictEqual(isRetryableTtsFailure({ httpStatus: 503 }), true);
  assert.strictEqual(isRetryableTtsFailure({ httpStatus: 401 }), false, '401 must fail hard');
  assert.strictEqual(isRetryableTtsFailure({ httpStatus: 400 }), false, '400 must fail hard');
  assert.strictEqual(isRetryableTtsFailure({ message: 'boom' }), false, 'no code/status fails hard');
});
