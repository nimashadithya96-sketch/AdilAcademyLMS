import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = path.resolve(
  process.env.APP_STORAGE_DIR || "/app/storage"
);

function getStoragePath(objectKey: string) {
  const filePath = path.resolve(STORAGE_ROOT, objectKey);

  if (
    filePath === STORAGE_ROOT ||
    !filePath.startsWith(STORAGE_ROOT + path.sep)
  ) {
    throw new Error("INVALID_STORAGE_OBJECT_KEY");
  }

  return filePath;
}

export async function uploadPrivateFile(
  objectKey: string,
  contents: Buffer
) {
  try {
    const filePath = getStoragePath(objectKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  } catch (error) {
    console.error("Local Storage upload failed", error);
    throw new Error("APP_STORAGE_UNAVAILABLE");
  }
}

export async function downloadPrivateFile(objectKey: string) {
  try {
    const filePath = getStoragePath(objectKey);
    return await readFile(filePath);
  } catch (error) {
    console.error("Local Storage download failed", error);
    throw new Error("APP_STORAGE_UNAVAILABLE");
  }
}

export async function deletePrivateFile(objectKey: string) {
  try {
    const filePath = getStoragePath(objectKey);
    await unlink(filePath);
  } catch (error) {
    console.error("Local Storage delete failed", error);
    throw new Error("APP_STORAGE_UNAVAILABLE");
  }
}
