import { NextResponse } from "next/server";
import { adminCookieOptions, createAdminSession, verifyAdminCredentials } from "@/lib/auth";
import { sameOrigin } from "@/lib/security";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password || !(await verifyAdminCredentials(username, password))) {
    return Response.json({ error: "用户名或密码错误。" }, { status: 401 });
  }
  try {
    const token = await createAdminSession(username);
    const response = NextResponse.json({ ok: true });
    response.cookies.set({ name: "mfm_admin_session", value: token, ...adminCookieOptions });
    return response;
  } catch {
    return Response.json({ error: "服务端鉴权未配置。" }, { status: 503 });
  }
}
