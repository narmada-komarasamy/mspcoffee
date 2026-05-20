'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// ── Helpers ────────────────────────────────────────────────────────────────

function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|windows phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

async function getIP(): Promise<string> {
  // Cache per session so we only fetch once
  const cached = sessionStorage.getItem('msp_ip');
  if (cached) return cached;
  try {
    const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    const { ip } = await res.json();
    sessionStorage.setItem('msp_ip', ip);
    return ip;
  } catch {
    return 'unknown';
  }
}

function getSessionId(): string {
  let sid = sessionStorage.getItem('msp_session_id');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('msp_session_id', sid);
  }
  return sid;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useActivityTracker(pageLabel?: string) {
  const pathname  = usePathname();
  const enteredAt = useRef<number>(Date.now());
  const rowId     = useRef<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('msp_user');
    if (!stored) return;
    const user = JSON.parse(stored);

    enteredAt.current = Date.now();
    rowId.current     = null;

    // Insert a row on page enter (duration filled on exit)
    (async () => {
      const ip = await getIP();
      const { data } = await supabase
        .from('user_activity')
        .insert({
          user_id:      user.id,
          user_name:    user.name,
          user_role:    user.role,
          page_path:    pathname,
          page_label:   pageLabel ?? pathname,
          entered_at:   new Date().toISOString(),
          device_type:  getDeviceType(),
          ip_address:   ip,
          user_agent:   navigator.userAgent,
          session_id:   getSessionId(),
        })
        .select('id')
        .single();

      if (data) rowId.current = data.id;
    })();

    // Update duration on navigation away / unmount
    return () => {
      const secs = Math.round((Date.now() - enteredAt.current) / 1000);
      if (rowId.current !== null) {
        supabase
          .from('user_activity')
          .update({ duration_secs: secs })
          .eq('id', rowId.current)
          .then(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
