import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { getFeedback } from "@/lib/content/repository";
import { jsonError } from "@/lib/security";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(request))) return jsonError("Unauthorized", 401);
  const { id } = await params;
  const record = await getFeedback(id);
  return record ? NextResponse.json({ record }) : jsonError("Feedback not found.", 404);
}
