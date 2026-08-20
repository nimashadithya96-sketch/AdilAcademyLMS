import { Client } from "@replit/object-storage";

let storageClient: Client | null = null;

function client() {
  storageClient ??= new Client();
  return storageClient;
}

export async function uploadPrivateFile(
  objectKey: string,
  contents: Buffer
) {
  try {
    const result = await client().uploadFromBytes(objectKey, contents);
    if (!result.ok) {
      throw new Error(String(result.error));
    }
  } catch (error) {
    console.error("App Storage upload failed", error);
    throw new Error("APP_STORAGE_UNAVAILABLE");
  }
}

export async function downloadPrivateFile(objectKey: string) {
  try {
    const result = await client().downloadAsBytes(objectKey);
    if (!result.ok) {
      throw new Error(String(result.error));
    }
    return result.value[0];
  } catch (error) {
    console.error("App Storage download failed", error);
    throw new Error("APP_STORAGE_UNAVAILABLE");
  }
}


export async function deletePrivateFile(objectKey: string) {
  try {
    const result = await client().delete(objectKey);
    if (!result.ok) {
      throw new Error(String(result.error));
    }
  } catch (error) {
    console.error("App Storage delete failed", error);
    throw new Error("APP_STORAGE_UNAVAILABLE");
  }
}
