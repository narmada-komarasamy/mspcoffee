import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { updatePassword } from './actions';

const ERROR_MESSAGES: Record<string, string> = {
  too_short:    'Password must be at least 8 characters.',
  mismatch:     'Passwords do not match.',
  update_failed: 'Unable to update password. The link may have expired.',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  const { error, reason } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?error=link_expired');
  }

  const isMustChange = reason === 'must_change';

  return (
    <div className="w-full max-w-sm space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white">
          {isMustChange ? 'Set a new password' : 'Reset password'}
        </h2>
        <p className="text-green-200/60 text-sm mt-1">
          {isMustChange
            ? 'Your account requires a password change before continuing.'
            : 'Choose a strong password for your account.'}
        </p>
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center bg-red-500/10 rounded-lg px-4 py-2.5">
          {ERROR_MESSAGES[error] ?? 'Something went wrong. Please try again.'}
        </p>
      )}

      <form action={updatePassword} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm text-green-200/70 mb-1.5">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#86efac]/50 focus:border-[#86efac]/50 transition"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm text-green-200/70 mb-1.5">
            Confirm password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Repeat your password"
            className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#86efac]/50 focus:border-[#86efac]/50 transition"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-[#86efac] text-[#1a2e1a] font-semibold py-3 transition hover:bg-[#6ee7a0] active:scale-[0.98]"
        >
          Set password
        </button>
      </form>
    </div>
  );
}
