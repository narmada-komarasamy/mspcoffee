import LoginForm from './LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = '/rainfall' } = await searchParams;
  return <LoginForm next={next} />;
}
