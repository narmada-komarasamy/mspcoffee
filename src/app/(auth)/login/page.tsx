'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Delete, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type AppUser = {
  id: string;
  name: string;
  pin: string;
  role: string;
  estate: string | null;
};

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('app_users')
      .select('*')
      .order('name')
      .then(({ data }) => {
        setUsers(data ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (pin.length === 4 && selectedUser) {
      if (pin === selectedUser.pin) {
        localStorage.setItem('msp_user', JSON.stringify(selectedUser));
        router.push('/home');
      } else {
        setError('Incorrect PIN');
        setTimeout(() => {
          setPin('');
          setError('');
        }, 800);
      }
    }
  }, [pin, selectedUser, router]);

  const handleDigit = (d: string) => {
    if (pin.length < 4) setPin((p) => p + d);
  };

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  const roleColor: Record<string, string> = {
    admin: 'text-yellow-400',
    supervisor: 'text-sky-400',
    worker: 'text-green-400',
  };

  const SLIDES = [
    { type: 'video' as const, src: '/bg-video-1.mp4' },
    { type: 'image' as const, src: '/cover-img-1.jpg',  alt: 'MSP Coffee' },
    { type: 'image' as const, src: '/cover-img-2.webp', alt: 'MSP Coffee' },
    { type: 'video' as const, src: '/bg-video-2.mp4' },
    { type: 'image' as const, src: '/cover-img-3.png',  alt: 'MSP Coffee' },
    { type: 'image' as const, src: '/cover-img-4.png',  alt: 'MSP Coffee' },
    { type: 'video' as const, src: '/bg-video-3.mp4' },
    { type: 'image' as const, src: '/cover-img-5.png',  alt: 'MSP Coffee' },
    { type: 'image' as const, src: '/cover-img-6.jpg',  alt: 'MSP Coffee' },
    { type: 'image' as const, src: '/cover-img-7.jpg',  alt: 'MSP Coffee' },
  ];
  const IMAGE_DURATION = 5000;  // ms per image
  const VIDEO_FALLBACK  = 12000; // max ms before forcing next if video stalls

  const [activeSlide, setActiveSlide] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const advance = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    const slide = SLIDES[activeSlide];

    // Play active video; pause all others
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === activeSlide && slide.type === 'video') {
        v.currentTime = 0;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });

    // Always set a fallback timer so the show never stalls
    const duration = slide.type === 'image' ? IMAGE_DURATION : VIDEO_FALLBACK;
    const timer = setTimeout(advance, duration);
    return () => clearTimeout(timer);
  }, [activeSlide, advance]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a2e1a]">
        <Loader2 className="h-8 w-8 animate-spin text-[#86efac]" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Background slideshow */}
      {SLIDES.map((slide, i) =>
        slide.type === 'video' ? (
          <video
            key={slide.src}
            ref={(el) => { videoRefs.current[i] = el; }}
            muted
            playsInline
            onEnded={advance}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
            style={{ opacity: activeSlide === i ? 1 : 0 }}
          >
            <source src={slide.src} type="video/mp4" />
          </video>
        ) : (
          <div
            key={slide.src}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: activeSlide === i ? 1 : 0 }}
          >
            <Image src={slide.src} alt={slide.alt} fill className="object-cover" sizes="100vw" priority={i === 0} />
          </div>
        )
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full">
        {/* Branding */}
        <div className="mb-8">
          <Image
            src="/msp-logo-new.png"
            alt="MSP Coffee"
            width={160}
            height={206}
            className="mx-auto drop-shadow-2xl"
            priority
          />
        </div>

        {!selectedUser ? (
          /* User selection */
          <div className="w-full max-w-sm space-y-3">
            <p className="text-center text-green-200/70 text-sm mb-4">
              Select your profile to sign in
            </p>
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className="w-full flex items-center gap-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 px-5 py-4 text-left transition hover:bg-white/20 hover:border-[#86efac]/40"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#86efac]/20 text-[#86efac] font-bold text-lg">
                  {u.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{u.name}</p>
                  <p className={`text-xs capitalize ${roleColor[u.role] ?? 'text-gray-400'}`}>
                    {u.role}
                    {u.estate && ` · ${u.estate}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* PIN entry */
          <div className="w-full max-w-xs space-y-6">
            <button
              onClick={() => {
                setSelectedUser(null);
                setPin('');
                setError('');
              }}
              className="text-green-200/70 text-sm hover:text-white transition"
            >
              &larr; Back
            </button>

            <div className="text-center">
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-[#86efac]/20 text-[#86efac] font-bold text-2xl mb-3">
                {selectedUser.name[0]}
              </div>
              <p className="text-white font-medium text-lg">{selectedUser.name}</p>
              <p className="text-green-200/60 text-sm">Enter your 4-digit PIN</p>
            </div>

            {/* PIN dots */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-4 w-4 rounded-full transition-all duration-150 ${
                    error
                      ? 'bg-red-500'
                      : i < pin.length
                        ? 'bg-[#86efac] scale-110'
                        : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
            {error && (
              <p className="text-center text-red-400 text-sm">{error}</p>
            )}

            {/* Number pad */}
            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map(
                (key) => {
                  if (key === '') return <div key="empty" />;
                  if (key === 'del')
                    return (
                      <button
                        key="del"
                        onClick={handleDelete}
                        className="flex items-center justify-center h-14 rounded-xl bg-white/10 text-white transition hover:bg-white/20"
                      >
                        <Delete className="h-5 w-5" />
                      </button>
                    );
                  return (
                    <button
                      key={key}
                      onClick={() => handleDigit(key)}
                      className="flex items-center justify-center h-14 rounded-xl bg-white/10 text-white text-xl font-medium transition hover:bg-white/20 active:bg-[#86efac]/30"
                    >
                      {key}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
