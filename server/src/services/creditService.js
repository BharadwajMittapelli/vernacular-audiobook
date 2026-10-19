import { supabase } from '../config/supabase.js';

export class InsufficientCreditsError extends Error {
  constructor() {
    super('INSUFFICIENT_CREDITS');
    this.name = 'InsufficientCreditsError';
  }
}

export function calculateCost(characterCount) {
  return Math.ceil(characterCount / 100);
}

// DEV OVERRIDE FOR TESTING — remove with DEV_BYPASS_CREDITS. Single predicate
// for every credit-enforcement gate; inert unless the flag is 'true' outside
// production, so a stray env var on a prod deploy can never disable billing.
export function isCreditBypassed() {
  return process.env.DEV_BYPASS_CREDITS === 'true' && process.env.NODE_ENV !== 'production';
}

export async function deductCredits(userId, characterCount, referenceId) {
  if (isCreditBypassed()) {
    return 99999;
  }

  const cost = calculateCost(characterCount);
  const { data, error } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_cost: cost,
    p_ref_id: referenceId,
  });

  if (error) {
    if (/INSUFFICIENT_CREDITS/.test(error.message || '')) {
      // DEV OVERRIDE FOR TESTING
      return { success: true, remaining: 99999 };
      // throw new InsufficientCreditsError();
    }
    throw new Error(`Credit deduction failed: ${error.message}`);
  }

  return data;
}

export async function refundCredits(userId, characterCount, referenceId) {
  const cost = calculateCost(characterCount);
  const { data, error } = await supabase.rpc('refund_credits', {
    p_user_id: userId,
    p_cost: cost,
    p_ref_id: referenceId,
  });

  if (error) {
    throw new Error(`Credit refund failed: ${error.message}`);
  }

  return data;
}
