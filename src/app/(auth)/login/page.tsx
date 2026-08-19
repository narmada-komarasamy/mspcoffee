'use client';

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

type SessionUser = {
  id: string;
  name: string;
  role: string;
  estate: string | null;
};

const SLIDES = [
  { type: 'video' as const, src: '/bg-video-1.mp4' },
  { type: 'image' as const, src: '/cover-img-1.jpg', alt: 'MSP Coffee' },
  { type: 'image' as const, src: '/cover-img-2.webp', alt: 'MSP Coffee' },
  { type: 'video' as const, src: '/bg-video-2.mp4' },
  { type: 'image' as const, src: '/cover-img-3.png', alt: 'MSP Coffee' },
  { type: 'video' as const, src: '/bg-video-3.mp4' },
];

const IMAGE_DURATION = 5000;
const VIDEO_FALLBACK = 12000;

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [muted, setMuted] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (response) => {
        if (!response.ok) return;
        const body = await response.json() as { user?: SessionUser };
        if (body.user) {
          localStorage.setItem('msp_user', JSON.stringify(body.user));
          router.replace('/home');
        }
      })
      .finally(() => setCheckingSession(false));
  }, [router]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.5;
    audio.muted = muted;

    const tryPlay = () => {
      audio.play().catch(() => {});
    };

    tryPlay();
    document.addEventListener('click', tryPlay, { once: true });
    document.addEventListener('touchstart', tryPlay, { once: true });

    return () => {
      document.removeEventListener('click', tryPlay);
      document.removeEventListener('touchstart', tryPlay);
    };
  }, [muted]);

  const advance = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    const slide = SLIDES[activeSlide];

    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index === activeSlide && slide.type === 'video') {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });

    const timer = window.setTimeout(advance, slide.type === 'image' ? IMAGE_DURATION : VIDEO_FALLBACK);
    return () => window.clearTimeout(timer);
  }, [activeSlide, advance]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    if (!response.ok) {
      setLoading(false);
      setError('Invalid email or password');
      return;
    }

    const profileResponse = await fetch('/api/auth/me');
    if (!profileResponse.ok) {
      setLoading(false);
      setError('Signed in, but your MSP Coffee profile is missing.');
      return;
    }

    const body = await profileResponse.json() as { user?: SessionUser };
    if (!body.user) {
      setLoading(false);
      setError('Signed in, but your MSP Coffee profile is missing.');
      return;
    }

    localStorage.setItem('msp_user', JSON.stringify(body.user));
    router.push(searchParams.get('redirectTo') || '/home');
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a2e1a]">
        <Loader2 className="h-8 w-8 animate-spin text-[#86efac]" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
      <audio ref={audioRef} src="/bg-music.m4a" loop preload="auto" />

      <button
        onClick={() => setMuted((value) => !value)}
        className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/30 text-white/70 hover:text-white hover:bg-black/50 transition"
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      {SLIDES.map((slide, index) =>
        slide.type === 'video' ? (
          <video
            key={slide.src}
            ref={(element) => { videoRefs.current[index] = element; }}
            muted
            playsInline
            onEnded={advance}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
            style={{ opacity: activeSlide === index ? 1 : 0 }}
          >
            <source src={slide.src} type="video/mp4" />
          </video>
        ) : (
          <div
            key={slide.src}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: activeSlide === index ? 1 : 0 }}
          >
            <Image src={slide.src} alt={slide.alt} fill className="object-cover" sizes="100vw" priority={index === 0} />
          </div>
        )
      )}

      <div className="absolute inset-0 bg-black/55" />

      <main className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/msp-logo-new.png"
            alt="MSP Coffee"
            width={150}
            height={193}
            className="mx-auto drop-shadow-2xl"
            priority
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-white/10 bg-black/35 p-5 backdrop-blur-md">
          <div className="space-y-1 text-center">
            <h1 className="text-lg font-semibold text-white">Sign in</h1>
            <p className="text-sm text-green-100/70">Use your MSP Coffee account</p>
          </div>

          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            placeholder="Email"
            className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/45 outline-none focus:border-[#86efac]/60"
            required
          />

          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/45 outline-none focus:border-[#86efac]/60"
            required
          />

          {error && (
            <p className="rounded-lg bg-red-950/75 px-3 py-2 text-center text-sm font-semibold text-red-100">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#86efac] px-4 py-3 font-semibold text-[#102510] transition hover:bg-[#bbf7d0] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>

          <button
            type="button"
            onClick={() => router.push('/forgot-password')}
            className="w-full text-sm font-medium text-green-100/75 transition hover:text-white"
          >
            Forgot password?
          </button>
        </form>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#1a2e1a]">
        <Loader2 className="h-8 w-8 animate-spin text-[#86efac]" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
