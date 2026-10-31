import React, { useState, useEffect } from 'react';
import { User as UserIcon, Mail, Camera, Lock, Trash2, LogOut, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from '../../context/NavigateContext.jsx';
import { supabase } from '../../lib/supabaseClient';
import { updateProfile, deleteAccount } from '../../services/api.js';
import {
  getRecentAccounts,
  pushRecentAccount,
  clearRecentAccounts,
} from '../../utils/recentAccounts.js';

const EKITAB_PREFIX = 'ekithab-';

export function AccountTab() {
  const { session, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const user = session?.user;

  const [fullName, setFullName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [originalAvatar, setOriginalAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetErr, setResetErr] = useState('');
  const [recentAccounts, setRecentAccounts] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    const name = user.user_metadata?.full_name || user.email || '';
    setFullName(name);
    setOriginalName(name);
    setEmail(user.email || '');
    const av = user.user_metadata?.avatar_url || '';
    setAvatarUrl(av);
    setOriginalAvatar(av);
    setRecentAccounts(getRecentAccounts().filter((a) => a.email !== user.email));
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    setSaveErr('');
    try {
      const payload = {};
      if (fullName !== originalName) payload.full_name = fullName;
      if (avatarUrl !== originalAvatar) payload.avatar_url = avatarUrl;
      if (Object.keys(payload).length > 0) {
        await updateProfile(payload);
        await supabase.auth.getSession().then(({ data }) => {
          if (data.session) {
            setOriginalName(data.session.user.user_metadata?.full_name || data.session.user.email || '');
            setOriginalAvatar(data.session.user.user_metadata?.avatar_url || '');
            setAvatarUrl(data.session.user.user_metadata?.avatar_url || '');
          }
        });
      }
      setSaveMsg('Profile updated');
    } catch (err) {
      setSaveErr(err.response?.data?.error || err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(originalName);
    setAvatarUrl(originalAvatar);
    setSaveMsg('');
    setSaveErr('');
  };

  const handleChangePassword = async () => {
    setResetSent(false);
    setResetErr('');
    if (!email) {
      setResetErr('No email address on file');
      return;
    }
    try {
      const frontendUrl = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5175';
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${frontendUrl}/update-password`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      setResetErr(err.message || 'Failed to send reset email');
    }
  };

  const handleLogout = async () => {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(EKITAB_PREFIX)) localStorage.removeItem(key);
      });
      await signOut();
      navigate('/');
    } catch (err) {
      setSaveErr(err?.message || 'Logout failed');
    }
  };

  const handleSwitchAccount = (targetEmail) => {
    localStorage.setItem('ekithab-pending-email', targetEmail);
    navigate('/auth');
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteMsg('');
    try {
      await deleteAccount();
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(EKITAB_PREFIX)) localStorage.removeItem(key);
      });
      await signOut();
      navigate('/');
    } catch (err) {
      setDeleteMsg(err?.response?.data?.error || err.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
      setShowResetModal(false);
    }
  };

  const initials = fullName
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-8">
      {/* Profile information */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Profile information</h2>
        <p className="text-sm text-muted-foreground mb-5">Update your profile information and manage your account.</p>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Name</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Email address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                disabled
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-muted text-sm focus:outline-none cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">To change your email, contact support.</p>
          </div>

          {/* Profile picture */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Profile picture</label>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-terracotta text-terracotta-foreground flex items-center justify-center text-sm font-semibold shrink-0 overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <button
                onClick={() => {
                  const url = prompt('Enter image URL for profile picture:');
                  if (url) setAvatarUrl(url);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors"
              >
                <Camera className="h-3.5 w-3.5" />
                Change photo
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG (max 2MB)</p>
          </div>
        </div>

        {/* Save/Cancel */}
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-terracotta text-background text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          {saveMsg && <p className="text-sm text-success">{saveMsg}</p>}
          {saveErr && <p className="text-sm text-destructive">{saveErr}</p>}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Switch account */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Switch account</h2>
            <p className="text-sm text-muted-foreground">Quickly sign in to a different account.</p>
          </div>
          {recentAccounts.length > 0 && (
            <button
              onClick={() => { clearRecentAccounts(); setRecentAccounts([]); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear history
            </button>
          )}
        </div>
        {recentAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No other accounts on record.</p>
        ) : (
          <div className="space-y-2">
            {recentAccounts.map((acc) => (
              <button
                key={acc.email}
                onClick={() => handleSwitchAccount(acc.email)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-terracotta text-background flex items-center justify-center text-xs font-semibold shrink-0">
                  {acc.displayName
                    .split(' ')
                    .map((s) => s[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{acc.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{acc.email}</p>
                </div>
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Security */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Security</h2>
            <p className="text-sm text-muted-foreground">Manage your password and account security.</p>
          </div>
          <button
            onClick={handleChangePassword}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Lock className="h-3.5 w-3.5" />
            Change password
          </button>
        </div>
        {resetSent && (
          <p className="mt-3 text-sm text-success">Password reset email sent. Check your inbox.</p>
        )}
        {resetErr && <p className="mt-3 text-sm text-destructive">{resetErr}</p>}
      </div>

      <div className="border-t border-border" />

      {/* Logout */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Log out</h2>
            <p className="text-sm text-muted-foreground">End your session and clear local data on this device.</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </button>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Delete account */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Delete account</h2>
            <p className="text-sm text-muted-foreground">Permanently delete your account and all associated data.</p>
          </div>
          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-destructive text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete account
          </button>
        </div>
      </div>

      {/* Confirmation modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-base font-semibold text-foreground mb-2">Delete account</h3>
            <p className="text-sm text-muted-foreground mb-5">
              This will permanently delete your account and all your data, including uploaded books and generated audio.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 px-3 py-2 rounded-lg border border-destructive text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              This action is permanent and cannot be undone.
            </p>
            {deleteMsg && <p className="text-xs text-destructive mt-2 text-center">{deleteMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
