import { z } from "zod";
import type { ContentDocument, FeedbackRecord } from "@/lib/types";

const localizedTextSchema = z.object({
  zh: z.string(),
  en: z.string(),
});

export const mediaAssetSchema = z.object({
  id: z.string().min(1),
  pathname: z.string().min(1),
  url: z.string(),
  filename: z.string().min(1),
  kind: z.enum(["image", "video", "audio", "document"]),
  contentType: z.string().min(1),
  size: z.number().nonnegative(),
  status: z.enum(["active", "missing"]),
  alt: localizedTextSchema,
  source: z.enum(["legacy-import", "uploaded", "missing"]),
  createdAt: z.string().min(1),
});

const siteSchema = z.object({
  title: localizedTextSchema,
  heroVideoAssetId: z.string().optional(),
  heroPosterAssetId: z.string().optional(),
  intro: localizedTextSchema,
  curator: localizedTextSchema,
  footerTagline: localizedTextSchema,
  openingHours: localizedTextSchema,
  contact: localizedTextSchema,
  easterNote: localizedTextSchema,
});

const eraSchema = z.object({
  id: z.string().min(1),
  label: localizedTextSchema,
  code: z.string().min(1),
  collection: z.enum(["western", "china"]),
  order: z.number().int(),
  visible: z.boolean(),
});

const artistSchema = z.object({
  id: z.string().min(1),
  canonicalName: z.string().min(1),
  displayName: localizedTextSchema,
  life: z.string(),
  story: localizedTextSchema,
  portraitAssetId: z.string().optional(),
  visible: z.boolean(),
  order: z.number().int(),
});

const workSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  collection: z.enum(["western", "china"]),
  title: localizedTextSchema,
  eraId: z.string().min(1),
  artistId: z.string().optional(),
  originalTitle: localizedTextSchema,
  year: z.string(),
  accession: z.string().min(1),
  primaryAssetId: z.string().min(1),
  originalAssetId: z.string().optional(),
  introduction: localizedTextSchema,
  curatorialNote: localizedTextSchema,
  trivia: localizedTextSchema,
  visible: z.boolean(),
  order: z.number().int(),
});

const quizQuestionSchema = z.object({
  id: z.string().min(1),
  question: localizedTextSchema,
  options: z.array(localizedTextSchema).min(2),
  order: z.number().int(),
  visible: z.boolean(),
});

const quizResultSchema = z.object({
  id: z.string().min(1),
  name: localizedTextSchema,
  collectionNumber: z.string().min(1),
  rarity: z.number().int().min(1).max(5),
  habitat: localizedTextSchema,
  comment: z.array(localizedTextSchema).min(1),
  imageAssetId: z.string().optional(),
  order: z.number().int(),
  visible: z.boolean(),
});

const updateLogSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  title: localizedTextSchema,
  body: localizedTextSchema,
  visible: z.boolean(),
  order: z.number().int(),
});

export const contentDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().min(1),
  site: siteSchema,
  assets: z.array(mediaAssetSchema),
  eras: z.array(eraSchema),
  artists: z.array(artistSchema),
  works: z.array(workSchema),
  quiz: z.object({
    questions: z.array(quizQuestionSchema),
    results: z.array(quizResultSchema),
  }),
  logs: z.array(updateLogSchema),
});

export const feedbackAttachmentSchema = z.object({
  id: z.string().min(1),
  pathname: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().nonnegative(),
  downloadUrl: z.string().optional(),
});

export const feedbackRecordSchema = z.object({
  id: z.string().min(1),
  message: z.string().min(1).max(10000),
  attachments: z.array(feedbackAttachmentSchema).max(6),
  status: z.enum(["new", "read", "archived"]),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export function parseContentDocument(value: unknown): ContentDocument {
  return contentDocumentSchema.parse(value) as ContentDocument;
}

export function parseFeedbackRecord(value: unknown): FeedbackRecord {
  return feedbackRecordSchema.parse(value) as FeedbackRecord;
}
