// Upload limits and accepted types, without zod: the browser upload queue imports them on every screen.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 64 * 1024;
export const FILE_TYPES = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'audio/mpeg': ['mp3'],
  'audio/ogg': ['ogg'],
  'audio/wav': ['wav'],
  'video/mp4': ['mp4'],
} as const;
export type FileMime = keyof typeof FILE_TYPES;
