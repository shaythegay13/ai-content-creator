import { getMedia } from '@/services/workspace';
import { providers } from '@/providers';
import { z } from 'zod';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response('Not found', { status: 404 });
  try {
    const media = await getMedia(id);
    if (!media || media.storageProvider === 'mock')
      return new Response('Sample metadata has no file', { status: 404 });
    const bytes = await providers().storage.get(media.storageKey);
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': media.mimeType,
        'Content-Length': String(bytes.length),
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(media.filename)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return new Response('Media unavailable', { status: 404 });
  }
}
