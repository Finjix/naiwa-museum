import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { deleteBlob, isBlobConfigured } from "@/lib/blob";
import { getDraftContent, saveDraft } from "@/lib/content/repository";
import { referencedAssetIds } from "@/lib/content/utils";
import { sameOrigin, jsonError } from "@/lib/security";

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return jsonError("Unauthorized", 401);
  const document = await getDraftContent();
  return NextResponse.json({ assets: document.assets, referenced: [...referencedAssetIds(document)] });
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest(request))) return jsonError("Unauthorized", 401);
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const body = await request.json().catch(() => null) as { id?: unknown; baseRevision?: unknown } | null;
  if (typeof body?.id !== "string" || typeof body.baseRevision !== "number") return jsonError("Invalid asset deletion payload.");
  const document = await getDraftContent();
  const asset = document.assets.find((item) => item.id === body.id);
  if (!asset) return jsonError("Asset not found.", 404);
  if (referencedAssetIds(document).has(asset.id)) return jsonError("该媒体正在被内容引用，请先解除引用。", 409);
  try {
    if (asset.pathname.startsWith("media/") && isBlobConfigured("media")) await deleteBlob(asset.pathname, "media");
    const next = await saveDraft({ ...document, assets: document.assets.filter((item) => item.id !== asset.id) }, body.baseRevision);
    return NextResponse.json({ document: next });
  } catch {
    return jsonError("媒体删除失败。", 400);
  }
}
