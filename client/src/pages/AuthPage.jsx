import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from '../context/NavigateContext.jsx';

export default function AuthPage() {
  const { signIn, signUp, signInWithGoogle, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      setSubmitting(false);
      return;
    }

    let result;
    if (mode === 'signin') {
      result = await signIn(email, password);
    } else {
      result = await signUp(email, password);
    }

    if (result.error) {
      // ponytail: Supabase shows "confirm your email" when email confirmation is enabled
      const msg = result.error.message || 'Authentication failed';
      if (msg.toLowerCase().includes('confirm')) {
        setError(msg + ' Please check your inbox.');
      } else {
        setError(msg);
      }
    } else {
      navigate('/my-books');
    }
    setSubmitting(false);
  };

  const handleGoogle = () => {
    // ponytail: immediate redirect, no loading state needed for OAuth
    signInWithGoogle();
  };

  const isSignup = mode === 'signup';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-sidebar/50 h-14 flex items-center px-4">
        <div className="flex items-center gap-2 font-serif text-xl font-semibold tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-terracotta flex items-center justify-center shadow-sm">
            <BookOpen className="text-terracotta-foreground" size={18} />
          </div>
          <span className="text-foreground">Ekithab AI</span>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-terracotta/10 flex items-center justify-center mx-auto">
              <BookOpen className="text-terracotta" size={32} />
            </div>
            <h2 className="font-serif text-3xl tracking-tight text-foreground">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isSignup
                ? 'Sign up to start building your audiobooks.'
                : 'Log in to access your bookstore.'}
            </p>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              className="w-full p-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full p-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
            {isSignup && (
              <input
                type="password"
                placeholder="Confirm Password"
                className="w-full p-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            )}
            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full bg-terracotta text-terracotta-foreground rounded-lg py-3 font-medium hover:bg-terracotta/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-px bg-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="bg-background px-3 text-muted-foreground">or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogle}
            className="w-full border border-border bg-background rounded-lg py-3 font-medium text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-sm text-muted-foreground">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError(''); }}
              className="text-terracotta hover:underline font-medium"
            >
              {isSignup ? 'Log in' : 'Sign up'}
            </button>
          </p>

          <p className="text-xs text-muted-foreground text-center">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </main>
    </div>
  );
}
