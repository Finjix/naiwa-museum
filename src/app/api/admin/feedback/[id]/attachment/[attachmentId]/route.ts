import { getPrivateBlobResponse } from "@/lib/blob";
import { isAdminRequest } from "@/lib/admin";
import { getFeedback } from "@/lib/content/repository";
import { jsonError } from "@/lib/security";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  if (!(await isAdminRequest(request))) return jsonError("Unauthorized", 401);
  const { id, attachmentId } = await params;
  const record = await getFeedback(id);
  const attachment = record?.attachments.find((item) => item.id === attachmentId || item.pathname.endsWith(`/${attachmentId}`));
  if (!attachment) return jsonError("Attachment not found.", 404);
  try {
    const blob = await getPrivateBlobResponse(attachment.pathname);
    if (!blob) return jsonError("Attachment not found.", 404);
    const headers = new Headers();
    blob.headers.forEach((value, key) => headers.set(key, value));
    headers.set("Content-Disposition", `inline; filename="${attachment.filename.replace(/[\"\r\n]/g, "_")}"`);
    return new Response(blob.stream, { status: 200, headers });
  } catch {
    return jsonError("Attachment unavailable.", 404);
  }
}
