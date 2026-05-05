'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export default function LoginForm({ next }: { next: string }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Incorrect email or password.');
      setLoading(false);
      return;
    }

    // Hard navigate so the browser sends all cookies in the first request.
    // router.push() can race with cookie writes; window.location is safe.
    window.location.href = next;
  }

  return (
    <div className="w-full max-w-sm space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white">Sign in</h2>
        <p className="text-green-200/60 text-sm mt-1">
          Enter your credentials to continue
        </p>
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center bg-red-500/10 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm text-green-200/70 mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#86efac]/50 focus:border-[#86efac]/50 transition"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm text-green-200/70 mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#86efac]/50 focus:border-[#86efac]/50 transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#86efac] text-[#1a2e1a] font-semibold py-3 transition hover:bg-[#6ee7a0] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="text-center">
        <Link
          href="/forgot-password"
          className="text-sm text-green-200/60 hover:text-[#86efac] transition"
        >
          Forgot your password?
        </Link>
      </div>
    </div>
  );
}
