import { supabase } from '../config/supabase.js';

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    if (process.env.NODE_ENV === 'development') {
      req.user = { id: '00000000-0000-0000-0000-000000000001' };
      return next();
    }
    return res.status(401).json({ success: false, error: 'Missing Authorization header' });
  }

  const token = header.startsWith('Bearer ') ? header.slice(7) : header;

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    // Ensure application user record exists before protected operations
    // User provisioning happens here because no signup hook or trigger exists
    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        { id: user.id, email: user.email, credits: 500 },
        { onConflict: 'id', ignoreDuplicates: true }
      );

    if (upsertError) {
      console.error('authMiddleware user upsert error:', upsertError.message);
      // Stop request: don't continue to chapter insert that will predictably fail
      return res.status(500).json({ success: false, error: 'Failed to provision user' });
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch (err) {
    console.error('authMiddleware error:', err.message);
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}
