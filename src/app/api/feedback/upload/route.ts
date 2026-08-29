import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isBlobConfigured, requireBlobToken } from "@/lib/blob";
import { sameOrigin, safePathSegment, safeUploadName, jsonError } from "@/lib/security";

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm",
  "application/pdf", "text/plain", "application/zip", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function POST(request: Request) {
  if (!isBlobConfigured("private")) return jsonError("当前环境未配置私有 Blob 存储。", 503);
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const body = await request.json() as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      token: requireBlobToken("private"),
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const segments = pathname.split("/");
        const payload = typeof clientPayload === "string" ? JSON.parse(clientPayload) as { submissionId?: string } : {};
        if (segments.length !== 3 || segments[0] !== "feedback" || !safePathSegment(segments[1]) || payload.submissionId !== segments[1] || safeUploadName(segments[2]) !== segments[2]) throw new Error("Invalid feedback upload path.");
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: 10 * 1024 * 1024,
          validUntil: Date.now() + 30 * 60 * 1000,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ submissionId: segments[1] }),
        };
      },
    });
    return Response.json(result);
  } catch {
    return jsonError("附件上传失败。", 400);
  }
}
