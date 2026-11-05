import { mkdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import * as R from 'remeda';

/** `Instant Pot Chili` becomes `instant-pot-chili`, for file names. */
export function slug(name: string) {
  const words = name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
  return R.toKebabCase(words) || 'recipe';
}

/**
 * Where an export goes: the given absolute path, else the first existing folder in `dirs`
 * (the last is created if none exists). An existing file is never overwritten unless asked.
 */
export async function exportPath(options: {
  dirs: string[];
  name: string;
  ext: string;
  output?: string;
  overwrite?: boolean;
}) {
  const { dirs, name, ext, output, overwrite = false } = options;
  const dir = (await firstExisting(dirs)) ?? dirs.at(-1)!;
  const path = output ?? join(dir, `${slug(name)}.${ext}`);
  if (!isAbsolute(path)) throw new Error('Output path must be absolute');
  if (!path.endsWith(`.${ext}`)) throw new Error(`Output path must end in .${ext}`);
  if (output) {
    if (!(await exists(dirname(path)))) throw new Error(`Folder ${dirname(path)} does not exist`);
  } else {
    await mkdir(dirname(path), { recursive: true });
  }
  if ((await exists(path)) && !overwrite)
    throw new Error(`${path} already exists; pass overwrite to replace it`);
  return path;
}

function exists(path: string) {
  return stat(path).then(
    () => true,
    () => false,
  );
}

async function firstExisting(paths: string[]) {
  for (const path of paths) if (await exists(path)) return path;
  return undefined;
}
