import type {
  CollectionId,
  ContentDocument,
  Era,
  MediaAsset,
  Work,
} from "@/lib/types";

export const ERA_LABELS: Record<string, { zh: string; en: string; code: string }> = {
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

export function localized(value: { zh: string; en: string }, locale: "zh" | "en") {
  return value[locale] || value.zh;
}

export function visibleWorks(document: ContentDocument, collection: CollectionId) {
  return document.works
    .filter((work) => work.visible && work.collection === collection)
    .sort((a, b) => a.order - b.order);
}

export function filterWorks(works: Work[], eraId: string) {
  return eraId === "all" ? works : works.filter((work) => work.eraId === eraId);
}

export function paginate<T>(items: T[], page: number, pageSize = 6) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  return {
    items: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    page: safePage,
    pageCount,
  };
}

export function getAsset(document: ContentDocument, id?: string): MediaAsset | undefined {
  return id ? document.assets.find((asset) => asset.id === id) : undefined;
}

export function erasForCollection(document: ContentDocument, collection: CollectionId): Era[] {
  const present = new Set(visibleWorks(document, collection).map((work) => work.eraId));
  return document.eras
    .filter((era) => era.visible && era.collection === collection && present.has(era.id))
    .sort((a, b) => a.order - b.order);
}

export function referencedAssetIds(document: ContentDocument) {
  const refs = new Set<string>();
  if (document.site.heroVideoAssetId) refs.add(document.site.heroVideoAssetId);
  if (document.site.heroPosterAssetId) refs.add(document.site.heroPosterAssetId);
  document.works.forEach((work) => {
    refs.add(work.primaryAssetId);
    if (work.originalAssetId) refs.add(work.originalAssetId);
  });
  document.artists.forEach((artist) => {
    if (artist.portraitAssetId) refs.add(artist.portraitAssetId);
  });
  document.quiz.results.forEach((result) => {
    if (result.imageAssetId) refs.add(result.imageAssetId);
  });
  return refs;
}

export function normalizeLegacyText(value: string | undefined) {
  return (value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();
}

export function slugify(value: string, fallback: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return slug || fallback;
}

export function nowIso() {
  return new Date().toISOString();
}
