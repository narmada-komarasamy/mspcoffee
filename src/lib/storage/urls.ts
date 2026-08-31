export function signedStorageUrl(bucket: string, path: string | null | undefined) {
  if (!path) return '';
  const params = new URLSearchParams({ bucket, path });
  return `/api/storage/signed-url?${params.toString()}`;
}
