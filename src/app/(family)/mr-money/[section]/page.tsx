import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MR_MONEY_SECTIONS } from '@/lib/mr-money';

export function generateStaticParams() {
  return MR_MONEY_SECTIONS.map(section => ({ section: section.slug }));
}

export default async function MoneySectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: slug } = await params;
  const section = MR_MONEY_SECTIONS.find(item => item.slug === slug);
  if (!section) notFound();
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <Link href="/mr-money" className="text-sm font-semibold" style={{ color: 'var(--t-accent)' }}>← MR Money</Link>
      <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--t-text)' }}>{section.label}</h1>
    </div>
  );
}
