import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isAdminRequest } from "@/lib/admin";
import { isBlobConfigured, requireBlobToken } from "@/lib/blob";
import { sameOrigin, safePathSegment, safeUploadName, jsonError } from "@/lib/security";

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
  "video/mp4", "video/webm", "audio/mpeg", "audio/wav", "audio/ogg",
  "application/pdf", "text/plain", "application/zip",
];

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return jsonError("Unauthorized", 401);
  if (!isBlobConfigured("media")) return jsonError("当前环境未配置公开媒体 Blob 存储。", 503);
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const body = await request.json() as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      token: requireBlobToken("media"),
      onBeforeGenerateToken: async (pathname) => {
        const segments = pathname.split("/");
        const filename = segments[2] || "";
        if (segments.length !== 3 || segments[0] !== "media" || !["image", "video", "audio", "document"].includes(segments[1]) || !safePathSegment(filename) || safeUploadName(filename) !== filename) throw new Error("Invalid media upload path.");
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: 500 * 1024 * 1024,
          validUntil: Date.now() + 30 * 60 * 1000,
          addRandomSuffix: false,
        };
      },
    });
    return Response.json(result);
  } catch {
    return jsonError("媒体上传失败。", 400);
  }
}
