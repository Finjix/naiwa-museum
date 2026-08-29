import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { listFeedback, updateFeedbackStatus } from "@/lib/content/repository";
import { sameOrigin, jsonError } from "@/lib/security";
import type { FeedbackStatus } from "@/lib/types";

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return jsonError("Unauthorized", 401);
  return NextResponse.json({ records: await listFeedback() });
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest(request))) return jsonError("Unauthorized", 401);
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const body = await request.json().catch(() => null) as { id?: unknown; status?: unknown } | null;
  if (typeof body?.id !== "string" || !["new", "read", "archived"].includes(String(body.status))) return jsonError("Invalid feedback status.");
  const record = await updateFeedbackStatus(body.id, body.status as FeedbackStatus);
  return record ? NextResponse.json({ record }) : jsonError("Feedback not found.", 404);
}
