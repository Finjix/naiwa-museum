import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { getBlobMetadata, isBlobConfigured } from "@/lib/blob";
import { registerAsset } from "@/lib/content/repository";
import { mediaAssetSchema } from "@/lib/content/schema";
import { sameOrigin, jsonError } from "@/lib/security";

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return jsonError("Unauthorized", 401);
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const body = await request.json().catch(() => null) as { asset?: unknown; baseRevision?: unknown } | null;
  if (!body || typeof body.baseRevision !== "number") return jsonError("Invalid asset payload.");
  const asset = mediaAssetSchema.safeParse(body.asset);
  if (!asset.success || !asset.data.pathname.startsWith("media/")) return jsonError("Invalid media asset.");
  if (!isBlobConfigured("media")) return jsonError("当前环境未配置公开媒体 Blob 存储。", 503);
  try {
    const metadata = await getBlobMetadata(asset.data.pathname, "media");
    const normalized = mediaAssetSchema.parse({ ...asset.data, url: metadata.url, pathname: metadata.pathname, size: metadata.size, contentType: metadata.contentType || asset.data.contentType, status: "active", source: "uploaded" });
    const document = await registerAsset(normalized, body.baseRevision);
    return NextResponse.json({ document });
  } catch (error) {
    if (error instanceof Error && error.name === "RevisionConflictError") return NextResponse.json({ error: "内容已被其他编辑更新，请重新载入。" }, { status: 409 });
    return jsonError("媒体登记失败。", 400);
  }
}
