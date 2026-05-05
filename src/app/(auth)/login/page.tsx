import Link from 'next/link';
import { signIn } from './actions';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  missing_fields:      'Please enter your email and password.',
  link_expired:        'That link has expired. Request a new one.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = '/rainfall', error } = await searchParams;

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
          {ERROR_MESSAGES[error] ?? 'Something went wrong. Please try again.'}
        </p>
      )}

      <form action={signIn} className="space-y-4">
        <input type="hidden" name="next" value={next} />

        <div>
          <label htmlFor="email" className="block text-sm text-green-200/70 mb-1.5">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#86efac]/50 focus:border-[#86efac]/50 transition"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm text-green-200/70 mb-1.5">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#86efac]/50 focus:border-[#86efac]/50 transition"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-[#86efac] text-[#1a2e1a] font-semibold py-3 transition hover:bg-[#6ee7a0] active:scale-[0.98]"
        >
          Sign in
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
