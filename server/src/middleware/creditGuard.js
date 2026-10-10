import { calculateCredits } from '../services/textProcessor.js';

/**
 * Credit guard middleware stub.
 * TODO: implement atomic credit deduction once the users table exists.
 * For now, skip deduction and set creditsUsed to 0.
 */
export function creditGuardMiddleware(req, res, next) {
  const { text } = req.body || {};
  req.creditsUsed = text ? calculateCredits(text) : 0;
  next();
}
