import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { getContentSnapshot, saveDraft } from "@/lib/content/repository";
import { parseContentDocument } from "@/lib/content/schema";
import { sameOrigin, jsonError } from "@/lib/security";
import { RevisionConflictError } from "@/lib/types";

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return jsonError("Unauthorized", 401);
  return NextResponse.json(await getContentSnapshot());
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest(request))) return jsonError("Unauthorized", 401);
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const body = await request.json().catch(() => null) as { document?: unknown; baseRevision?: unknown } | null;
  if (!body || typeof body.baseRevision !== "number") return jsonError("Invalid content payload.");
  try {
    const next = await saveDraft(parseContentDocument(body.document), body.baseRevision);
    return NextResponse.json({ document: next });
  } catch (error) {
    if (error instanceof RevisionConflictError) return NextResponse.json({ error: "内容已被其他编辑更新，请重新载入。", currentRevision: error.currentRevision }, { status: 409 });
    return jsonError("内容保存失败。", 500);
  }
}
