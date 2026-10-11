import { stripMarkdown } from '../services/textProcessor.js';
import { calculateCost } from '../services/creditService.js';

/**
 * Computes the credit cost for the incoming synthesis request and attaches it
 * as req.creditsUsed. Actual atomic deduction happens in the synthesize handler
 * AFTER the idempotency placeholder is won, so replays never double-charge.
 */
export function creditGuardMiddleware(req, _res, next) {
  const { text } = req.body || {};
  const characterCount = text ? stripMarkdown(text).length : 0;
  req.creditsUsed = calculateCost(characterCount);
  next();
}
