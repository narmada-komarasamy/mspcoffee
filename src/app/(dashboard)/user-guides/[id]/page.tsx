import GuideLibrary from '../guide-library';
export default async function UserGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GuideLibrary guideId={id} />;
}
