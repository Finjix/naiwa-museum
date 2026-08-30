import { getPrivateBlobResponse } from "@/lib/blob";
import { isAdminRequest } from "@/lib/admin";
import { getFeedback } from "@/lib/content/repository";
import { jsonError } from "@/lib/security";

function contentDisposition(filename: string) {
  const fallback = filename
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_")
    .trim() || "attachment";
  const encoded = encodeURIComponent(filename).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  if (!(await isAdminRequest(request))) return jsonError("Unauthorized", 401);
  const { id, attachmentId } = await params;
  const record = await getFeedback(id);
  const attachment = record?.attachments.find((item) => item.id === attachmentId || item.pathname.endsWith(`/${attachmentId}`));
  if (!attachment) return jsonError("Attachment not found.", 404);
  try {
    const blob = await getPrivateBlobResponse(attachment.pathname);
    if (!blob || blob.statusCode !== 200) return jsonError("Attachment not found.", 404);
    const headers = new Headers();
    blob.headers.forEach((value, key) => headers.set(key, value));
    headers.set("Content-Disposition", contentDisposition(attachment.filename));
    return new Response(blob.stream, { status: 200, headers });
  } catch {
    return jsonError("Attachment unavailable.", 404);
  }
}
