import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getBlobMetadata, isBlobConfigured, uploadBlob, writeBlobJson } from "../src/lib/blob";
import { parseContentDocument } from "../src/lib/content/schema";
import { safeUploadName } from "../src/lib/security";
import type { ContentDocument, MediaAsset } from "../src/lib/types";

const root = process.cwd();
const assetsDirectory = path.join(root, "奶蛙博物馆 · Musée du Milk Frog_files");
if (process.env.MUSEUM_DATA_SOURCE !== "blob") throw new Error("Set MUSEUM_DATA_SOURCE=blob before running the Blob migration.");
if (!isBlobConfigured("media") || !isBlobConfigured("private")) throw new Error("BLOB_MEDIA_READ_WRITE_TOKEN and BLOB_PRIVATE_READ_WRITE_TOKEN are required.");

const seed = parseContentDocument(JSON.parse(readFileSync(path.join(root, "src", "data", "legacy-seed.json"), "utf8"))) as ContentDocument;
function sourcePath(asset: MediaAsset) {
  return asset.kind === "video" ? path.join(root, asset.filename) : path.join(assetsDirectory, asset.filename);
}

async function existing(pathname: string) {
  try { return await getBlobMetadata(pathname, "media"); } catch { return null; }
}

async function migrateAsset(asset: MediaAsset) {
  if (asset.status !== "active" || asset.source !== "legacy-import") return asset;
  const localPath = sourcePath(asset);
  if (!existsSync(localPath)) return { ...asset, status: "missing" as const, source: "missing" as const, url: "", size: 0 };
  const pathname = `media/${asset.kind}/${asset.id}-${safeUploadName(asset.filename)}`;
  const found = await existing(pathname);
  if (found) return { ...asset, pathname: found.pathname, url: found.url, size: found.size, contentType: found.contentType || asset.contentType, source: "uploaded" as const };
  const body = await readFile(localPath);
  const uploaded = await uploadBlob(pathname, body, "media", asset.contentType);
  console.log(`Uploaded ${asset.filename} -> ${uploaded.pathname}`);
  return { ...asset, pathname: uploaded.pathname, url: uploaded.url, source: "uploaded" as const };
}

const migratedAssets: MediaAsset[] = [];
for (const asset of seed.assets) migratedAssets.push(await migrateAsset(asset));
const migrated: ContentDocument = { ...seed, assets: migratedAssets, revision: Math.max(1, seed.revision), updatedAt: new Date().toISOString() };
const revision = `${migrated.revision}-migration-${Date.now()}`;
await writeBlobJson(`content/history/${revision}.json`, migrated, "private");
await writeBlobJson("content/draft.json", migrated, "private");
await writeBlobJson("content/published.json", migrated, "private");
await writeBlobJson("assets/index.json", { schemaVersion: 1, updatedAt: migrated.updatedAt, assets: migratedAssets }, "private");
console.log(`Blob migration complete: ${migratedAssets.filter((asset) => asset.source === "uploaded").length} assets uploaded, ${migratedAssets.filter((asset) => asset.status === "missing").length} assets pending.`);
