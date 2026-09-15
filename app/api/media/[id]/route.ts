import { getMedia } from '@/services/workspace';
import { providers } from '@/providers';
import { z } from 'zod';
export async function GET(
  request: Request,
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
    const range = request.headers.get('range');
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match)
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${bytes.length}` },
        });
      const start = Number(match[1]);
      const end = match[2]
        ? Math.min(Number(match[2]), bytes.length - 1)
        : bytes.length - 1;
      if (start > end || start >= bytes.length)
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${bytes.length}` },
        });
      return new Response(new Uint8Array(bytes.slice(start, end + 1)), {
        status: 206,
        headers: {
          'Content-Type': media.mimeType,
          'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
          'Content-Length': String(end - start + 1),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': media.mimeType,
        'Content-Length': String(bytes.length),
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(media.filename)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch {
    return new Response('Media unavailable', { status: 404 });
  }
}
