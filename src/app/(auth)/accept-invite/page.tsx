import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { acceptInvite } from './actions';

const ERROR_MESSAGES: Record<string, string> = {
  missing_name:  'Please enter your name.',
  too_short:     'Password must be at least 8 characters.',
  mismatch:      'Passwords do not match.',
  update_failed: 'Unable to activate account. The invite link may have expired.',
};

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?error=link_expired');
  }

  // Pre-fill name from profile (seeded by trigger from user_metadata).
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single();

  const defaultName = profile?.name ?? user.email ?? '';

  return (
    <div className="w-full max-w-sm space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white">Welcome to MSP Coffee</h2>
        <p className="text-green-200/60 text-sm mt-1">
          Set your name and a password to activate your account.
        </p>
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center bg-red-500/10 rounded-lg px-4 py-2.5">
          {ERROR_MESSAGES[error] ?? 'Something went wrong. Please try again.'}
        </p>
      )}

      <form action={acceptInvite} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm text-green-200/70 mb-1.5">
            Your name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={defaultName}
            autoComplete="name"
            placeholder="Full name"
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
          Activate account
        </button>
      </form>
    </div>
  );
}
