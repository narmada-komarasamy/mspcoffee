import { Coffee } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#1a2e1a] to-[#2d4a2d] px-4">
      <div className="flex items-center gap-3 mb-8">
        <Coffee className="h-10 w-10 text-[#86efac]" />
        <h1 className="text-3xl font-bold text-white tracking-tight">
          MSP <span className="text-[#86efac]">Coffee</span>
        </h1>
      </div>
      {children}
    </div>
  );
}
