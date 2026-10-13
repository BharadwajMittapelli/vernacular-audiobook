import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '../components/ui/button.jsx';

export default function Login() {
  const { signIn, signInWithGoogle, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const { error } = await signIn(email, password);
    if (error) setError(error.message || 'Login failed');
    setSubmitting(false);
  };

  const handleGoogle = async () => {
    await signInWithGoogle();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-sidebar/50 h-14 flex items-center px-4">
        <div className="flex items-center gap-2.5">
          <span className="text-lg font-bold tracking-tight text-foreground">Ekithab AI</span>
          <span className="text-xs text-muted-foreground font-medium">Audiobook</span>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <h2 className="text-2xl font-semibold">Welcome back</h2>
          <p className="text-sm text-muted-foreground">
            Log in to access your bookstore.
          </p>
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              className="w-full p-3 rounded border border-border bg-background"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full p-3 rounded border border-border bg-background"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" variant="default" className="w-full" disabled={submitting || loading}>
              {submitting ? 'Logging in...' : 'Log In'}
            </Button>
          </form>
          <Button onClick={handleGoogle} variant="ghost" className="w-full">
            Continue with Google
          </Button>
          <div className="text-center text-sm">
            <a href="/register" className="underline">Create an account</a>
          </div>
        </div>
      </main>
    </div>
  );
}
