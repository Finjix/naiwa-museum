import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  isBlobConfigured,
  readBlobJson,
  readBlobJsonWithMeta,
  writeBlobJson,
} from "@/lib/blob";
import { parseContentDocument, parseFeedbackRecord } from "@/lib/content/schema";
import type {
  ContentDocument,
  ContentSnapshot,
  FeedbackRecord,
  FeedbackStatus,
  MediaAsset,
} from "@/lib/types";
import { nowIso } from "@/lib/content/utils";
import seedJson from "@/data/legacy-seed.json";

const DRAFT_PATH = "content/draft.json";
const PUBLISHED_PATH = "content/published.json";
const HISTORY_PREFIX = "content/history";
const ASSET_INDEX_PATH = "assets/index.json";
const LOCAL_ROOT = path.join(process.cwd(), ".local-data");
const FEEDBACK_RECORD_PATH = /^feedback\/[a-zA-Z0-9_-]+\.json$/;

function cloneSeed() {
  return parseContentDocument(JSON.parse(JSON.stringify(seedJson)));
}

function blobStoreEnabled() {
  return process.env.MUSEUM_DATA_SOURCE === "blob" && isBlobConfigured("private");
}

async function readLocal<T>(relativePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(LOCAL_ROOT, relativePath), "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeLocal(relativePath: string, value: unknown) {
  const absolutePath = path.join(LOCAL_ROOT, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, JSON.stringify(value, null, 2), "utf8");
}

async function writeAssetIndex(document: ContentDocument) {
  if (!blobStoreEnabled()) return;
  await writeBlobJson(ASSET_INDEX_PATH, { schemaVersion: 1, updatedAt: document.updatedAt, assets: document.assets }, "private");
}

async function readDocument(pathname: string): Promise<{ value: ContentDocument; etag?: string } | null> {
  if (blobStoreEnabled()) {
    const result = await readBlobJsonWithMeta<ContentDocument>(pathname, "private");
    return result ? { value: parseContentDocument(result.value), etag: result.etag } : null;
  }
  const relative = pathname.replace(/^content\//, "");
  const value = await readLocal<ContentDocument>(relative);
  return value ? { value: parseContentDocument(value) } : null;
}

export async function getPublishedContent() {
  const stored = await readDocument(PUBLISHED_PATH);
  return stored?.value ?? cloneSeed();
}

export async function getDraftContent() {
  const stored = await readDocument(DRAFT_PATH);
  return stored?.value ?? (await getPublishedContent());
}

export async function getContentSnapshot(): Promise<ContentSnapshot> {
  const published = await getPublishedContent();
  const draft = (await readDocument(DRAFT_PATH))?.value ?? published;
  return { draft, published };
}

export async function saveDraft(document: ContentDocument, baseRevision: number) {
  const current = await getDraftContent();
  if (current.revision !== baseRevision) {
    const { RevisionConflictError } = await import("@/lib/types");
    throw new RevisionConflictError(current.revision);
  }

  const next = parseContentDocument({
    ...document,
    schemaVersion: 1,
    revision: current.revision + 1,
    updatedAt: nowIso(),
  });
  if (blobStoreEnabled()) {
    await writeBlobJson(DRAFT_PATH, next, "private");
  } else {
    await writeLocal("draft.json", next);
  }
  // The content document is the source of truth. The asset index is derived
  // data, so a transient index-write failure must not discard an admin save.
  try {
    await writeAssetIndex(next);
  } catch (error) {
    console.error("Failed to refresh asset index after saving content.", error);
  }
  return next;
}

export async function publishDraft() {
  const draft = await getDraftContent();
  const historyPath = `${HISTORY_PREFIX}/${draft.revision}-${Date.now()}.json`;
  if (blobStoreEnabled()) {
    await writeBlobJson(historyPath, draft, "private");
    await writeBlobJson(PUBLISHED_PATH, draft, "private");
  } else {
    await writeLocal(path.join("history", `${draft.revision}-${Date.now()}.json`), draft);
    await writeLocal("published.json", draft);
  }
  return draft;
}

function feedbackPath(id: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid feedback id.");
  return `feedback/${id}.json`;
}

export async function saveFeedback(record: FeedbackRecord) {
  const parsed = parseFeedbackRecord(record);
  const pathname = feedbackPath(parsed.id);
  if (blobStoreEnabled()) await writeBlobJson(pathname, parsed, "private");
  else await writeLocal(pathname, parsed);
  return parsed;
}

export async function getFeedback(id: string) {
  const pathname = feedbackPath(id);
  if (blobStoreEnabled()) {
    const record = await readBlobJson<FeedbackRecord>(pathname, "private");
    return record ? parseFeedbackRecord(record) : null;
  }
  const record = await readLocal<FeedbackRecord>(pathname);
  return record ? parseFeedbackRecord(record) : null;
}

export async function listFeedback() {
  if (blobStoreEnabled()) {
    const { listBlobs } = await import("@/lib/blob");
    const blobs = (await listBlobs("private", "feedback/")).filter((blob) => FEEDBACK_RECORD_PATH.test(blob.pathname));
    const records = await Promise.all(
      blobs.map(async (blob) => {
        const value = await readBlobJson<FeedbackRecord>(blob.pathname, "private");
        return value ? parseFeedbackRecord(value) : null;
      }),
    );
    return records
      .filter((record): record is FeedbackRecord => Boolean(record))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  try {
    const files = await readdir(path.join(LOCAL_ROOT, "feedback"));
    const records = await Promise.all(
      files.filter((file) => file.endsWith(".json")).map((file) => readLocal<FeedbackRecord>(path.join("feedback", file))),
    );
    return records
      .filter((record): record is FeedbackRecord => Boolean(record))
      .map(parseFeedbackRecord)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus) {
  const current = await getFeedback(id);
  if (!current) return null;
  return saveFeedback({ ...current, status, updatedAt: nowIso() });
}

export async function registerAsset(asset: MediaAsset, baseRevision: number) {
  const current = await getDraftContent();
  if (current.assets.some((existing) => existing.id === asset.id)) return current;
  return saveDraft({ ...current, assets: [...current.assets, asset] }, baseRevision);
}
