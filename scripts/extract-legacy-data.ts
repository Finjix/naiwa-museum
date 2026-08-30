import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import vm from "node:vm";

import type {
  Artist,
  ContentDocument,
  Era,
  LocalizedText,
  MediaAsset,
  UpdateLog,
  Work,
} from "../src/lib/types";
import { normalizeLegacyText, slugify } from "../src/lib/content/utils";

const root = process.cwd();
const files = readFileNames(root);
const htmlPath = join(root, files.find((file) => file.endsWith(".html") && !file.endsWith("saved_resource.html")) || "");
const assetsDirectory = join(root, files.find((file) => file.includes("_files")) || "");
const appPath = join(assetsDirectory, "app.js.下载");
const videoPath = join(root, files.find((file) => file.endsWith(".mp4")) || "");

if (!existsSync(htmlPath) || !existsSync(appPath) || !existsSync(assetsDirectory)) {
  throw new Error("Legacy HTML, app.js.下载, or resource directory could not be found.");
}

const html = readFileSync(htmlPath, "utf8");
const appSource = readFileSync(appPath, "utf8");

function readFileNames(directory: string) {
  return readdirSync(directory);
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function plainText(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function localized(value: string, english = value): LocalizedText {
  return { zh: normalizeLegacyText(value), en: normalizeLegacyText(english) };
}

function evaluateLegacyData() {
  const dataSource = appSource.slice(0, appSource.indexOf("const UI_TEXT")).replace(/\bconst\b/g, "var").replace(/\blet\b/g, "var");
  const context: Record<string, unknown> = {};
  vm.runInNewContext(dataSource, context, { timeout: 5000 });
  return context as {
    WORKS: Array<Record<string, string>>;
    ARTIST_BIO: Record<string, Record<string, string>>;
  };
}

const legacy = evaluateLegacyData();
const legacyWorks = legacy.WORKS || [];
const artistBios = legacy.ARTIST_BIO || {};

const eraOrder = [
  "prehistoric",
  "ancient",
  "medieval",
  "renaissance",
  "baroque",
  "rococo",
  "realism",
  "romanticism",
  "pre-raphaelite",
  "ukiyoe",
  "impressionism",
  "postimpressionism",
  "modern",
  "china-pre-qin",
  "china-qin-han",
  "china-wei-jin",
  "china-sui-tang",
  "china-song",
  "china-ming-qing",
  "china-modern",
];

const eraInfo: Record<string, { zh: string; en: string; code: string }> = {
  prehistoric: { zh: "史前", en: "Prehistoric", code: "PRE" },
  ancient: { zh: "古典", en: "Classical", code: "ANT" },
  medieval: { zh: "中世纪", en: "Medieval", code: "MED" },
  renaissance: { zh: "文艺复兴", en: "Renaissance", code: "REN" },
  baroque: { zh: "巴洛克", en: "Baroque", code: "BAR" },
  rococo: { zh: "洛可可", en: "Rococo", code: "ROC" },
  realism: { zh: "现实主义", en: "Realism", code: "REA" },
  romanticism: { zh: "浪漫主义", en: "Romanticism", code: "ROM" },
  "pre-raphaelite": { zh: "拉斐尔前派", en: "Pre-Raphaelite", code: "PRA" },
  ukiyoe: { zh: "浮世绘", en: "Ukiyo-e", code: "UKI" },
  impressionism: { zh: "印象派", en: "Impressionism", code: "IMP" },
  postimpressionism: { zh: "后印象派", en: "Post-Impressionism", code: "PIM" },
  modern: { zh: "现代", en: "Modern", code: "MOD" },
  "china-pre-qin": { zh: "史前与先秦", en: "Prehistoric and Pre-Qin", code: "CNQ" },
  "china-qin-han": { zh: "秦汉", en: "Qin and Han", code: "QH" },
  "china-wei-jin": { zh: "魏晋南北朝", en: "Wei, Jin and Northern and Southern Dynasties", code: "WJN" },
  "china-sui-tang": { zh: "隋唐", en: "Sui and Tang", code: "SUT" },
  "china-song": { zh: "五代两宋", en: "Five Dynasties and Song", code: "SNG" },
  "china-ming-qing": { zh: "元明清", en: "Yuan, Ming and Qing", code: "MQR" },
  "china-modern": { zh: "近现代", en: "Modern China", code: "CNM" },
};

const cardFiles = new Map<string, string>();
const cardPattern = /<article class="card[^>]*data-era="[^"]+"[^>]*data-work-name="([^"]+)"[\s\S]*?<img[^>]+src="([^"]+)"/g;
for (const match of html.matchAll(cardPattern)) cardFiles.set(decodeHtml(match[1]), basename(match[2].replace(/\\/g, "/")));

const assets = new Map<string, MediaAsset>();
const missingByPath = new Map<string, string>();
const createdAt = "2026-08-29T00:00:00.000Z";

function contentTypeFor(filename: string) {
  const extension = extname(filename).toLowerCase();
  return {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
  }[extension] || "application/octet-stream";
}

function kindFor(contentType: string) {
  if (contentType.startsWith("image/")) return "image" as const;
  if (contentType.startsWith("video/")) return "video" as const;
  if (contentType.startsWith("audio/")) return "audio" as const;
  return "document" as const;
}

function assetId(prefix: string, filename: string) {
  return `${prefix}-${slugify(filename.replace(/\.[^.]+$/, ""), "file")}`;
}

function localAsset(filename: string, alt: LocalizedText) {
  const id = assetId("asset-local", filename);
  const filePath = join(assetsDirectory, filename);
  if (!existsSync(filePath)) return missingAsset(filename, alt);
  const contentType = contentTypeFor(filename);
  const asset: MediaAsset = {
    id,
    pathname: `legacy/${filename}`,
    url: `/api/legacy-media/${encodeURIComponent(filename)}`,
    filename,
    kind: kindFor(contentType),
    contentType,
    size: statSync(filePath).size,
    status: "active",
    alt,
    source: "legacy-import",
    createdAt,
  };
  assets.set(id, asset);
  return asset;
}

function missingAsset(reference: string, alt: LocalizedText) {
  const existingId = missingByPath.get(reference);
  if (existingId) return assets.get(existingId)!;
  const contentType = contentTypeFor(reference);
  const id = assetId("asset-missing", reference);
  const asset: MediaAsset = {
    id,
    pathname: reference,
    url: "",
    filename: basename(reference),
    kind: kindFor(contentType),
    contentType,
    size: 0,
    status: "missing",
    alt,
    source: "missing",
    createdAt,
  };
  assets.set(id, asset);
  missingByPath.set(reference, id);
  return asset;
}

const artistNames = [...new Set(legacyWorks.map((work) => work.artist).filter(Boolean))];
const artistIdByName = new Map<string, string>();
const artists: Artist[] = artistNames.map((canonicalName, index) => {
  const id = `artist-${String(index + 1).padStart(3, "0")}`;
  artistIdByName.set(canonicalName, id);
  const bio = artistBios[canonicalName] || {};
  const portraitReference = bio.portrait;
  const portraitAsset = portraitReference
    ? localAsset(basename(portraitReference), localized(bio.name || canonicalName))
    : undefined;
  return {
    id,
    canonicalName,
    displayName: localized(bio.name || canonicalName, canonicalName),
    life: bio.life || "",
    story: localized(normalizeLegacyText(bio.story || "这些作品没有留下可确认的个人署名。")),
    portraitAssetId: portraitAsset?.id,
    visible: true,
    order: index,
  };
});

const sortedLegacyWorks = legacyWorks
  .map((work, index) => ({ work, index }))
  .sort((a, b) => {
    const eraDifference = eraOrder.indexOf(a.work.era) - eraOrder.indexOf(b.work.era);
    return eraDifference || a.index - b.index;
  });
const eraCounters: Record<string, number> = {};
const works: Work[] = sortedLegacyWorks.map(({ work, index }) => {
  const collection = work.era.startsWith("china-") ? "china" : "western";
  const primaryFilename = cardFiles.get(work.zh);
  const primary = primaryFilename
    ? localAsset(primaryFilename, localized(work.zh, work.en))
    : missingAsset(work.url, localized(work.zh, work.en));
  const code = eraInfo[work.era]?.code || "GEN";
  eraCounters[code] = (eraCounters[code] || 0) + 1;
  const workId = `work-${String(index + 1).padStart(3, "0")}`;
  const note = normalizeLegacyText(work.story || "");
  return {
    id: workId,
    slug: `${slugify(work.zh, "work")}-${String(index + 1).padStart(3, "0")}`,
    collection,
    title: localized(work.zh, work.en),
    eraId: work.era,
    artistId: artistIdByName.get(work.artist),
    originalTitle: localized(work.orig || "仿 未知原作", "After the original work"),
    year: work.year || "",
    accession: `MFM · ${code}-${String(eraCounters[code]).padStart(2, "0")}`,
    primaryAssetId: primary.id,
    introduction: localized(note),
    visible: true,
    order: sortedLegacyWorks.findIndex((item) => item.index === index),
  };
});

const eras: Era[] = eraOrder
  .filter((id) => works.some((work) => work.eraId === id))
  .map((id, index) => ({
    id,
    label: localized(eraInfo[id]?.zh || id, eraInfo[id]?.en || id),
    code: eraInfo[id]?.code || "GEN",
    collection: id.startsWith("china-") ? "china" : "western",
    order: index,
    visible: true,
  }));

const logs: UpdateLog[] = [];
const logPattern = /<article class="log-entry"><time datetime="([^"]+)">[\s\S]*?<\/time><h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p><\/article>/g;
for (const [index, match] of [...html.matchAll(logPattern)].entries()) {
  const title = plainText(match[2]);
  const body = plainText(match[3]);
  if (/鉴定所|双语界面|夜间模式/.test(`${title}${body}`)) continue;
  logs.push({
    id: `log-${String(index + 1).padStart(3, "0")}`,
    date: match[1],
    title: localized(title),
    body: localized(body.replace("补充原作参考图、作品介绍、艺术鉴赏与创作轶事", "补充作品介绍")),
    visible: true,
    order: index,
  });
}

let heroVideoAssetId: string | undefined;
if (existsSync(videoPath)) {
  const filename = basename(videoPath);
  const contentType = contentTypeFor(filename);
  const asset: MediaAsset = {
    id: assetId("asset-local", filename),
    pathname: `legacy/${filename}`,
    url: `/api/legacy-media/${encodeURIComponent(filename)}`,
    filename,
    kind: "video",
    contentType,
    size: statSync(videoPath).size,
    status: "active",
    alt: localized("奶蛙博物馆入场影片", "Milk Frog Museum entry film"),
    source: "legacy-import",
    createdAt,
  };
  assets.set(asset.id, asset);
  heroVideoAssetId = asset.id;
}

const document: ContentDocument = {
  schemaVersion: 1,
  revision: 1,
  updatedAt: createdAt,
  site: {
    title: localized("奶蛙博物馆 · Musée du Milk Frog", "Milk Frog Museum · Musée du Milk Frog"),
    heroVideoAssetId,
    intro: localized(
      "穿越三万年的凝视，\n奶蛙栖身于人类最伟大的画布之中。\n从洞窟的火光到印象派的午后，\n一个圆润而沉静的身影，始终在场。",
      "Across thirty thousand years of looking,\nthe Milk Frog inhabits humanity’s greatest canvases.\nFrom cave fire to Impressionist afternoons,\na rounded, quiet presence remains.",
    ),
    curator: localized("广东技术师范大学奶娃博物馆馆长", "广东技术师范大学奶娃博物馆馆长"),
    footerTagline: localized("崇高与宁静在此相遇。", "Where the sublime meets the serene."),
    openingHours: localized("周二 — 周日\n10:00 — 18:00\n周一闭馆", "Tuesday — Sunday\n10:00 — 18:00\nClosed on Monday"),
    contact: localized("奶蛙馆长\n1145@qq.com\n+00 000 0000", "奶蛙馆长\n1145@qq.com\n+00 000 0000"),
  },
  assets: [...assets.values()],
  eras,
  artists,
  works,
  logs,
};

const outputPath = join(root, "src", "data", "legacy-seed.json");
writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
console.log(`Extracted ${works.length} works, ${artists.length} artists, ${assets.size} media records and ${logs.length} logs.`);
console.log(`Seed written to ${outputPath}`);
