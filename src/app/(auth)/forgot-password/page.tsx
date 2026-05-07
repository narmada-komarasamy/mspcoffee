import Link from 'next/link';
import { sendResetEmail } from './actions';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  if (sent) {
    return (
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-[#86efac]/20">
          <span className="text-3xl">✉️</span>
        </div>
        <h2 className="text-xl font-semibold text-white">Check your inbox</h2>
        <p className="text-green-200/60 text-sm">
          If that email is registered, we&apos;ve sent a password reset link.
          It expires in 1 hour.
        </p>
        <Link
          href="/login"
          className="block text-sm text-green-200/60 hover:text-[#86efac] transition"
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white">Forgot password</h2>
        <p className="text-green-200/60 text-sm mt-1">
          We&apos;ll send a reset link to your email.
        </p>
      </div>

      {error === 'missing_email' && (
        <p className="text-red-400 text-sm text-center bg-red-500/10 rounded-lg px-4 py-2.5">
          Please enter your email address.
        </p>
      )}

      <form action={sendResetEmail} className="space-y-4">
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

        <button
          type="submit"
          className="w-full rounded-xl bg-[#86efac] text-[#1a2e1a] font-semibold py-3 transition hover:bg-[#6ee7a0] active:scale-[0.98]"
        >
          Send reset link
        </button>
      </form>

      <div className="text-center">
        <Link
          href="/login"
          className="text-sm text-green-200/60 hover:text-[#86efac] transition"
        >
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
