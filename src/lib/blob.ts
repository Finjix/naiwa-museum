import { del, get, head, list, put, type GetBlobResult } from "@vercel/blob";

export type BlobStoreKind = "media" | "private";

function tokenFor(kind: BlobStoreKind) {
  return kind === "media"
    ? process.env.BLOB_MEDIA_READ_WRITE_TOKEN
    : process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
}

export function isBlobConfigured(kind: BlobStoreKind) {
  return Boolean(tokenFor(kind));
}

export function requireBlobToken(kind: BlobStoreKind) {
  const token = tokenFor(kind);
  if (!token) throw new Error(`Missing Blob token for ${kind} store.`);
  return token;
}

export async function readBlobJson<T>(pathname: string, kind: BlobStoreKind): Promise<T | null> {
  const result = await get(pathname, {
    access: kind === "media" ? "public" : "private",
    token: requireBlobToken(kind),
    useCache: false,
  });
  if (!result) return null;
  return JSON.parse(await new Response(result.stream).text()) as T;
}

export async function readBlobJsonWithMeta<T>(pathname: string, kind: BlobStoreKind) {
  const result = await get(pathname, {
    access: kind === "media" ? "public" : "private",
    token: requireBlobToken(kind),
    useCache: false,
  });
  if (!result) return null;
  return {
    value: JSON.parse(await new Response(result.stream).text()) as T,
    etag: result.blob.etag,
  };
}

export async function writeBlobJson(
  pathname: string,
  value: unknown,
  kind: BlobStoreKind,
  ifMatch?: string,
) {
  const token = requireBlobToken(kind);
  return put(pathname, JSON.stringify(value, null, 2), {
    access: kind === "media" ? "public" : "private",
    token,
    contentType: "application/json; charset=utf-8",
    allowOverwrite: true,
    ...(ifMatch ? { ifMatch } : {}),
  });
}

export async function uploadBlob(
  pathname: string,
  body: Parameters<typeof put>[1],
  kind: BlobStoreKind,
  contentType: string,
) {
  return put(pathname, body, {
    access: kind === "media" ? "public" : "private",
    token: requireBlobToken(kind),
    contentType,
    allowOverwrite: false,
    addRandomSuffix: false,
    multipart: true,
  });
}

export async function getBlobMetadata(pathname: string, kind: BlobStoreKind) {
  return head(pathname, { token: requireBlobToken(kind) });
}

export async function deleteBlob(pathname: string, kind: BlobStoreKind, ifMatch?: string) {
  return del(pathname, {
    token: requireBlobToken(kind),
    ...(ifMatch ? { ifMatch } : {}),
  });
}

export async function listBlobs(kind: BlobStoreKind, prefix?: string) {
  const blobs: Awaited<ReturnType<typeof list>>["blobs"] = [];
  let cursor: string | undefined;
  do {
    const page = await list({
      token: requireBlobToken(kind),
      prefix,
      limit: 1000,
      cursor,
    });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

export async function getPrivateBlobResponse(pathname: string): Promise<GetBlobResult | null> {
  const result = await get(pathname, {
    access: "private",
    token: requireBlobToken("private"),
    useCache: false,
  });
  return result;
}

export function blobPathFromUrl(value: string) {
  try {
    const url = new URL(value);
    return url.pathname.replace(/^\//, "");
  } catch {
    return null;
  }
}
