import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { parseContentDocument } from "../src/lib/content/schema";
import type { ContentDocument } from "../src/lib/types";

const root = process.cwd();
const document = parseContentDocument(JSON.parse(readFileSync(path.join(root, "src", "data", "legacy-seed.json"), "utf8"))) as ContentDocument;
const errors: string[] = [];
const western = document.works.filter((work) => work.collection === "western");
const china = document.works.filter((work) => work.collection === "china");
if (document.works.length !== 55) errors.push(`Expected 55 works, got ${document.works.length}.`);
if (western.length !== 45) errors.push(`Expected 45 western works, got ${western.length}.`);
if (china.length !== 10) errors.push(`Expected 10 China works, got ${china.length}.`);
const assetIds = new Set(document.assets.map((asset) => asset.id));
for (const work of document.works) {
  if (!assetIds.has(work.primaryAssetId)) errors.push(`${work.id} references a missing primary asset record.`);
  const asset = document.assets.find((item) => item.id === work.primaryAssetId);
  if (!asset || asset.status !== "active" || asset.kind !== "image") errors.push(`${work.id} does not have an active primary image.`);
}
for (const work of document.works) {
  if (!document.eras.some((era) => era.id === work.eraId)) errors.push(`${work.id} references an unknown era.`);
  if (work.artistId && !document.artists.some((artist) => artist.id === work.artistId)) errors.push(`${work.id} references an unknown artist.`);
}
const assetFiles = readdirSync(path.join(root, "奶蛙博物馆 · Musée du Milk Frog_files"));
const localPrimaryFiles = document.works.map((work) => document.assets.find((asset) => asset.id === work.primaryAssetId)?.filename).filter(Boolean);
for (const filename of localPrimaryFiles) if (!assetFiles.includes(filename as string)) errors.push(`Primary local media is missing: ${filename}`);
function scan(directory: string) {
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    const info = statSync(absolute);
    if (info.isDirectory()) scan(absolute);
    else if (/\.(ts|tsx|mjs|json)$/.test(entry) && !absolute.includes(`${path.sep}node_modules${path.sep}`)) {
      const source = readFileSync(absolute, "utf8");
      if (/neta\.art|cohub\.live|formsubmit\.co/i.test(source)) errors.push(`Legacy external resource found in ${path.relative(root, absolute)}.`);
    }
  }
}
scan(path.join(root, "src"));

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  const active = document.assets.filter((asset) => asset.status === "active").length;
  const missing = document.assets.length - active;
  console.log(`Migration check passed: ${document.works.length} works, ${document.artists.length} artists, ${active} active assets, ${missing} pending assets.`);
}
