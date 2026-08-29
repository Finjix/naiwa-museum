import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { publishDraft } from "@/lib/content/repository";
import { sameOrigin, jsonError } from "@/lib/security";

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return jsonError("Unauthorized", 401);
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  try {
    return NextResponse.json({ document: await publishDraft() });
  } catch {
    return jsonError("内容发布失败。", 500);
  }
}
