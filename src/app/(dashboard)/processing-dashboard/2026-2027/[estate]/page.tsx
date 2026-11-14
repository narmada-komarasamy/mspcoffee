import { notFound } from 'next/navigation';
import ProcessingRegister from '@/components/processing/ProcessingRegister';
import { PROCESSING_ESTATES } from '@/lib/processing';

export default async function ProcessingEstatePage({ params }: { params: Promise<{ estate: string }> }) {
  const { estate } = await params;
  if (!PROCESSING_ESTATES.some(e => e.slug === estate)) notFound();
  return <ProcessingRegister key={estate} initialEstate={estate} />;
}
