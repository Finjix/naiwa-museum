export type Locale = "zh" | "en";
export type CollectionId = "western" | "china";
export type MediaKind = "image" | "video" | "audio" | "document";
export type MediaStatus = "active" | "missing";
export type FeedbackStatus = "new" | "read" | "archived";

export interface LocalizedText {
  zh: string;
  en: string;
}

export interface MediaAsset {
  id: string;
  pathname: string;
  url: string;
  filename: string;
  kind: MediaKind;
  contentType: string;
  size: number;
  status: MediaStatus;
  alt: LocalizedText;
  source: "legacy-import" | "uploaded" | "missing";
  createdAt: string;
}

export interface SiteConfig {
  title: LocalizedText;
  heroVideoAssetId?: string;
  heroPosterAssetId?: string;
  intro: LocalizedText;
  curator: LocalizedText;
  footerTagline: LocalizedText;
  openingHours: LocalizedText;
  contact: LocalizedText;
  easterNote: LocalizedText;
}

export interface Era {
  id: string;
  label: LocalizedText;
  code: string;
  collection: CollectionId;
  order: number;
  visible: boolean;
}

export interface Artist {
  id: string;
  canonicalName: string;
  displayName: LocalizedText;
  life: string;
  story: LocalizedText;
  portraitAssetId?: string;
  visible: boolean;
  order: number;
}

export interface Work {
  id: string;
  slug: string;
  collection: CollectionId;
  title: LocalizedText;
  eraId: string;
  artistId?: string;
  originalTitle: LocalizedText;
  year: string;
  accession: string;
  primaryAssetId: string;
  originalAssetId?: string;
  introduction: LocalizedText;
  curatorialNote: LocalizedText;
  trivia: LocalizedText;
  visible: boolean;
  order: number;
}

export interface QuizQuestion {
  id: string;
  question: LocalizedText;
  options: LocalizedText[];
  order: number;
  visible: boolean;
}

export interface QuizResult {
  id: string;
  name: LocalizedText;
  collectionNumber: string;
  rarity: number;
  habitat: LocalizedText;
  comment: LocalizedText[];
  imageAssetId?: string;
  order: number;
  visible: boolean;
}

export interface QuizConfig {
  questions: QuizQuestion[];
  results: QuizResult[];
}

export interface UpdateLog {
  id: string;
  date: string;
  title: LocalizedText;
  body: LocalizedText;
  visible: boolean;
  order: number;
}

export interface ContentDocument {
  schemaVersion: 1;
  revision: number;
  updatedAt: string;
  site: SiteConfig;
  assets: MediaAsset[];
  eras: Era[];
  artists: Artist[];
  works: Work[];
  quiz: QuizConfig;
  logs: UpdateLog[];
}

export interface FeedbackAttachment {
  id: string;
  pathname: string;
  filename: string;
  contentType: string;
  size: number;
  downloadUrl?: string;
}

export interface FeedbackRecord {
  id: string;
  message: string;
  attachments: FeedbackAttachment[];
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ContentSnapshot {
  draft: ContentDocument;
  published: ContentDocument;
}

export class RevisionConflictError extends Error {
  readonly currentRevision: number;

  constructor(currentRevision: number) {
    super(`Content revision conflict. Current revision is ${currentRevision}.`);
    this.name = "RevisionConflictError";
    this.currentRevision = currentRevision;
  }
}
