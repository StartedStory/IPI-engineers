import { randomBytes } from 'node:crypto';

// Short URL-safe id for storage object names.
export function nanoid(len = 16) {
  return randomBytes(len)
    .toString('base64url')
    .slice(0, len);
}
