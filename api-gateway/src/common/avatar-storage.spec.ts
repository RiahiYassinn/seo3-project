import { BadRequestException } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  AVATAR_PUBLIC_PREFIX,
  removeStoredAvatar,
  storeAvatarFile,
  UploadedAvatarFile,
} from './avatar-storage';

jest.mock('fs/promises');

const mkdirMock = mkdir as jest.MockedFunction<typeof mkdir>;
const writeFileMock = writeFile as jest.MockedFunction<typeof writeFile>;
const unlinkMock = unlink as jest.MockedFunction<typeof unlink>;

const uploadDir = join(process.cwd(), 'uploads', 'avatars');

const file = (overrides: Partial<UploadedAvatarFile> = {}): UploadedAvatarFile => ({
  mimetype: 'image/png',
  size: 1024,
  originalname: 'me.png',
  buffer: Buffer.from('binary'),
  ...overrides,
});

describe('storeAvatarFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a missing file', async () => {
    await expect(storeAvatarFile(undefined as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it('rejects a non-image mimetype', async () => {
    await expect(
      storeAvatarFile(file({ mimetype: 'application/pdf' })),
    ).rejects.toThrow('Only image files are allowed');
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it('rejects a file with no mimetype at all', async () => {
    await expect(
      storeAvatarFile(file({ mimetype: undefined as never })),
    ).rejects.toThrow('Only image files are allowed');
  });

  it('rejects a file over the 5MB ceiling', async () => {
    await expect(
      storeAvatarFile(file({ size: 5 * 1024 * 1024 + 1 })),
    ).rejects.toThrow('Avatar size must be less than 5MB');
  });

  it('accepts a file exactly at the 5MB ceiling', async () => {
    await expect(
      storeAvatarFile(file({ size: 5 * 1024 * 1024 })),
    ).resolves.toContain(AVATAR_PUBLIC_PREFIX);
  });

  it('creates the upload directory before writing', async () => {
    await storeAvatarFile(file());

    expect(mkdirMock).toHaveBeenCalledWith(uploadDir, { recursive: true });
    expect(writeFileMock).toHaveBeenCalledTimes(1);
  });

  it('returns a public path with a random name and the original extension', async () => {
    const publicPath = await storeAvatarFile(file({ originalname: 'Photo.JPEG' }));

    expect(publicPath).toMatch(
      new RegExp(`^${AVATAR_PUBLIC_PREFIX}[0-9a-f-]{36}\\.jpeg$`),
    );
    expect(writeFileMock).toHaveBeenCalledWith(
      join(uploadDir, publicPath.replace(AVATAR_PUBLIC_PREFIX, '')),
      expect.any(Buffer),
    );
  });

  it('never reuses a name across uploads of the same file', async () => {
    const first = await storeAvatarFile(file());
    const second = await storeAvatarFile(file());

    expect(first).not.toBe(second);
  });

  it('falls back to the mimetype subtype when the name has no extension', async () => {
    await expect(
      storeAvatarFile(file({ originalname: 'avatar', mimetype: 'image/webp' })),
    ).resolves.toMatch(/\.webp$/);
  });
});

describe('removeStoredAvatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a non-string value', 42 as never],
    ['a remote URL', 'https://cdn.example.com/avatars/a.png'],
    // Guards against a stored path being used to unlink outside the avatar dir.
    ['a path outside the avatar directory', '/uploads/../../etc/passwd'],
  ])('ignores %s', async (_label, value) => {
    await removeStoredAvatar(value as string | null | undefined);

    expect(unlinkMock).not.toHaveBeenCalled();
  });

  it('unlinks the file named by a stored avatar path', async () => {
    await removeStoredAvatar(`${AVATAR_PUBLIC_PREFIX}abc.png`);

    expect(unlinkMock).toHaveBeenCalledWith(join(uploadDir, 'abc.png'));
  });

  it('swallows unlink failures so a stale file cannot break the request', async () => {
    unlinkMock.mockRejectedValueOnce(new Error('ENOENT'));

    await expect(
      removeStoredAvatar(`${AVATAR_PUBLIC_PREFIX}gone.png`),
    ).resolves.toBeUndefined();
  });
});
