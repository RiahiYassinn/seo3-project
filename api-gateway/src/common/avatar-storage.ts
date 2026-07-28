import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';

export type UploadedAvatarFile = {
  mimetype: string;
  size: number;
  originalname: string;
  buffer: Buffer;
};

export const AVATAR_PUBLIC_PREFIX = '/uploads/avatars/';

const AVATAR_UPLOAD_DIR = join(process.cwd(), 'uploads', 'avatars');
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

/** Validates and persists an uploaded avatar, returning its public path. */
export async function storeAvatarFile(
  file: UploadedAvatarFile,
): Promise<string> {
  if (!file) {
    throw new BadRequestException('Avatar file is required');
  }

  if (!file.mimetype?.startsWith('image/')) {
    throw new BadRequestException('Only image files are allowed');
  }

  if (file.size > MAX_AVATAR_SIZE) {
    throw new BadRequestException('Avatar size must be less than 5MB');
  }

  await mkdir(AVATAR_UPLOAD_DIR, { recursive: true });

  const extensionFromName = file.originalname?.includes('.')
    ? file.originalname.split('.').pop()?.toLowerCase()
    : null;
  const extension = extensionFromName || file.mimetype.split('/').pop() || 'png';
  const fileName = `${randomUUID()}.${extension}`;

  await writeFile(join(AVATAR_UPLOAD_DIR, fileName), file.buffer);

  return `${AVATAR_PUBLIC_PREFIX}${fileName}`;
}

/** Best-effort cleanup of a previously stored avatar. Never throws. */
export async function removeStoredAvatar(
  avatarPath?: string | null,
): Promise<void> {
  if (
    typeof avatarPath !== 'string' ||
    !avatarPath.startsWith(AVATAR_PUBLIC_PREFIX)
  ) {
    return;
  }

  const fileName = avatarPath.split('/').pop();
  if (!fileName) {
    return;
  }

  try {
    await unlink(join(AVATAR_UPLOAD_DIR, fileName));
  } catch {
    // Ignore cleanup failures for old files.
  }
}
