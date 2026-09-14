import { z } from 'zod';
export const createContentSchema = z.object({
  kind: z.enum(['idea', 'post']),
  title: z.string().trim().min(3).max(240),
  body: z.string().trim().min(1).max(20000),
  platform: z.enum(['x', 'linkedin', 'both']).default('both'),
});
export const allowedMediaTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
]);
export function validateUpload(size: number, mime: string) {
  if (size < 1 || size > 20 * 1024 * 1024)
    throw new Error('Choose a file between 1 byte and 20 MB.');
  if (!allowedMediaTypes.has(mime))
    throw new Error(
      'Unsupported format. Use JPEG, PNG, WebP, GIF, MP4, WebM, MP3, M4A, WAV or OGG.',
    );
}
