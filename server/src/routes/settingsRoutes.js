import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

const SUPPORTED_LANGUAGES = [
  'en-IN', 'hi-IN', 'te-IN', 'ta-IN', 'kn-IN',
  'ml-IN', 'mr-IN', 'bn-IN', 'gu-IN', 'pa-IN',
];

// GET /api/settings/stats — user credits, book count, audio duration
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: userData, error: userErr } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single();

    if (userErr) {
      console.error('GET /settings/stats — users query error:', userErr.message);
      return res.status(500).json({ success: false, error: 'Failed to fetch user stats' });
    }

    const { count: booksCount, error: booksErr } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (booksErr) {
      console.error('GET /settings/stats — books count error:', booksErr.message);
      return res.status(500).json({ success: false, error: 'Failed to count books' });
    }

    const { data: audioData, error: audioErr } = await supabase
      .from('audio_generations')
      .select('duration')
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (audioErr) {
      console.error('GET /settings/stats — audio duration error:', audioErr.message);
      return res.status(500).json({ success: false, error: 'Failed to fetch audio stats' });
    }

    const totalAudioSeconds = (audioData || []).reduce((sum, g) => sum + (g.duration || 0), 0);

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const memberSince = authUser?.user?.created_at;

    res.json({
      success: true,
      credits: userData?.credits ?? 0,
      booksCount: booksCount ?? 0,
      totalAudioSeconds,
      memberSince,
    });
  } catch (error) {
    console.error('GET /settings/stats error:', error.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/settings/profile — update full_name and/or avatar_url
router.put('/profile', async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, avatar_url } = req.body || {};

    const allowed = {};
    if (full_name !== undefined) {
      if (typeof full_name !== 'string') {
        return res.status(400).json({ success: false, error: 'full_name must be a string' });
      }
      allowed.full_name = full_name.trim();
    }
    if (avatar_url !== undefined) {
      if (typeof avatar_url !== 'string') {
        return res.status(400).json({ success: false, error: 'avatar_url must be a string' });
      }
      allowed.avatar_url = avatar_url.trim() || undefined;
    }

    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    const { data, error } = await supabase.auth.admin.updateUserById(userId, { data: allowed });
    if (error) {
      console.error('PUT /settings/profile error:', error.message);
      return res.status(500).json({ success: false, error: 'Failed to update profile' });
    }

    res.json({ success: true, user: data?.user });
  } catch (error) {
    console.error('PUT /settings/profile error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/settings/preferences — persist preferred_language to auth user metadata
router.put('/preferences', async (req, res) => {
  try {
    const userId = req.user.id;
    const { language } = req.body || {};

    if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({
        success: false,
        error: `language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`,
      });
    }

    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      data: { preferred_language: language },
    });

    if (error) {
      console.error('PUT /settings/preferences error:', error.message);
      return res.status(500).json({ success: false, error: 'Failed to update language preference' });
    }

    res.json({ success: true, language: data?.user?.user_metadata?.preferred_language });
  } catch (error) {
    console.error('PUT /settings/preferences error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/settings/account — hard-delete the current user and all their data
router.delete('/account', async (req, res) => {
  try {
    const userId = req.user.id;

    const deleteFrom = async (table) => {
      const { error } = await supabase.from(table).delete().eq('user_id', userId);
      if (error) throw error;
    };

    // Delete child rows first (service_role bypasses RLS)
    await deleteFrom('downloads');
    await deleteFrom('credit_transactions');
    await deleteFrom('audio_generations');
    await deleteFrom('chapters');
    await deleteFrom('books');
    await deleteFrom('users');

    // Remove the auth user (terminates all sessions)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) {
      console.error('DELETE /settings/account auth error:', authError.message);
      return res.status(500).json({ success: false, error: 'Failed to delete auth account' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /settings/account error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
