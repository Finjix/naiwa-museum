import { verifyAdminSession, ADMIN_SESSION_COOKIE } from "@/lib/auth";

export async function isAdminRequest(request: Request) {
  return verifyAdminSession(request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${ADMIN_SESSION_COOKIE}=`))?.slice(ADMIN_SESSION_COOKIE.length + 1));
}

export function sessionTokenFromRequest(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${ADMIN_SESSION_COOKIE}=`));
  return cookie?.slice(ADMIN_SESSION_COOKIE.length + 1);
}
