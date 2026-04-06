import fs from 'node:fs/promises';
import path from 'node:path';

export async function pathExists(targetPath) {
  try {
    await fs.lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function removePathIfPresent(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

async function syncFileIncremental(sourcePath, destinationPath) {
  const sourceStat = await fs.stat(sourcePath);
  const destinationExists = await pathExists(destinationPath);
  if (destinationExists) {
    const destinationStat = await fs.lstat(destinationPath);
    if (!destinationStat.isFile()) {
      await removePathIfPresent(destinationPath);
    } else if (
      destinationStat.size === sourceStat.size &&
      Math.trunc(destinationStat.mtimeMs) === Math.trunc(sourceStat.mtimeMs)
    ) {
      return;
    }
  }

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
  await fs.utimes(destinationPath, sourceStat.atime, sourceStat.mtime);
}

async function syncSymlinkIncremental(sourcePath, destinationPath) {
  const sourceLink = await fs.readlink(sourcePath);
  const destinationExists = await pathExists(destinationPath);
  if (destinationExists) {
    const destinationStat = await fs.lstat(destinationPath);
    if (destinationStat.isSymbolicLink()) {
      const destinationLink = await fs.readlink(destinationPath);
      if (destinationLink === sourceLink) {
        return;
      }
    }
    await removePathIfPresent(destinationPath);
  }

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.symlink(sourceLink, destinationPath);
}

async function syncPathIncremental(sourcePath, destinationPath) {
  const sourceStat = await fs.lstat(sourcePath);

  if (sourceStat.isSymbolicLink()) {
    await syncSymlinkIncremental(sourcePath, destinationPath);
    return;
  }

  if (sourceStat.isDirectory()) {
    await syncDirIncremental(sourcePath, destinationPath);
    return;
  }

  if (sourceStat.isFile()) {
    await syncFileIncremental(sourcePath, destinationPath);
  }
}

export async function syncFileOrRemove(sourcePath, destinationPath) {
  if (!(await pathExists(sourcePath))) {
    await removePathIfPresent(destinationPath);
    return false;
  }
  await syncFileIncremental(sourcePath, destinationPath);
  return true;
}

export async function syncDirOrRemove(sourcePath, destinationPath) {
  if (!(await pathExists(sourcePath))) {
    await removePathIfPresent(destinationPath);
    return false;
  }
  await syncDirIncremental(sourcePath, destinationPath);
  return true;
}

export async function syncDirIncremental(sourcePath, destinationPath) {
  const sourceStat = await fs.lstat(sourcePath);
  if (!sourceStat.isDirectory()) {
    throw new Error(`incremental sync expects a directory source: ${sourcePath}`);
  }

  const destinationExists = await pathExists(destinationPath);
  if (destinationExists) {
    const destinationStat = await fs.lstat(destinationPath);
    if (!destinationStat.isDirectory()) {
      await removePathIfPresent(destinationPath);
    }
  }

  await fs.mkdir(destinationPath, { recursive: true });

  const sourceEntries = await fs.readdir(sourcePath, { withFileTypes: true });
  const sourceNames = new Set(sourceEntries.map((entry) => entry.name));
  await Promise.all(
    sourceEntries.map((entry) =>
      syncPathIncremental(path.join(sourcePath, entry.name), path.join(destinationPath, entry.name)),
    ),
  );

  const destinationEntries = await fs.readdir(destinationPath, { withFileTypes: true });
  await Promise.all(
    destinationEntries
      .filter((entry) => !sourceNames.has(entry.name))
      .map((entry) => removePathIfPresent(path.join(destinationPath, entry.name))),
  );
}
