import { NextResponse } from "next/server";
import { getBlobMetadata, isBlobConfigured } from "@/lib/blob";
import { getFeedback, saveFeedback } from "@/lib/content/repository";
import { feedbackAttachmentSchema, parseFeedbackRecord } from "@/lib/content/schema";
import { nowIso } from "@/lib/content/utils";
import { sameOrigin, safePathSegment, jsonError } from "@/lib/security";
import type { FeedbackAttachment } from "@/lib/types";
import { z } from "zod";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const body = await request.json().catch(() => null) as { id?: unknown; message?: unknown; attachments?: unknown } | null;
  const id = typeof body?.id === "string" && body.id.length <= 80 && safePathSegment(body.id) ? body.id : crypto.randomUUID().replaceAll("-", "");
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const attachmentResult = z.array(feedbackAttachmentSchema).max(1).safeParse(body?.attachments ?? []);
  if (!attachmentResult.success) return jsonError("附件格式无效。", 400);
  const attachments = attachmentResult.data as FeedbackAttachment[];
  if (!message || message.length > 10000) return jsonError("意见内容不能为空且不能超过 10000 字。", 400);
  if (attachments.some((attachment) => typeof attachment.size !== "number" || attachment.size < 0 || attachment.size > MAX_FILE_SIZE)) return jsonError("只能上传一个文件，且文件不能超过 10 MB。", 400);
  if (attachments.length && !isBlobConfigured("private")) return jsonError("当前环境未配置私有 Blob 存储，暂不支持附件。", 503);
  if (attachments.length) {
    for (const attachment of attachments) {
      if (!attachment.pathname.startsWith(`feedback/${id}/`) || attachment.pathname !== `feedback/${id}/${attachment.id}` || !safePathSegment(attachment.id)) return jsonError("附件路径无效。", 400);
      try {
        const metadata = await getBlobMetadata(attachment.pathname, "private");
        if (metadata.size !== attachment.size || metadata.contentType !== attachment.contentType) return jsonError("附件校验失败。", 400);
      } catch {
        return jsonError("附件不存在或已过期。", 400);
      }
    }
  }
  if (await getFeedback(id)) return jsonError("该意见已提交。", 409);
  const timestamp = nowIso();
  const record = parseFeedbackRecord({ id, message, attachments, status: "new", createdAt: timestamp, updatedAt: timestamp });
  await saveFeedback(record);
  return NextResponse.json({ record }, { status: 201 });
}
