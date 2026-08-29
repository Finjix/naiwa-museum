import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";

export const ADMIN_SESSION_COOKIE = "mfm_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function secret() {
  const configured = process.env.AUTH_SECRET;
  if (!configured && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required in production.");
  return new TextEncoder().encode(configured || "milk-frog-local-development-secret");
}

export function adminUsername() {
  return process.env.ADMIN_USERNAME || "admin";
}

export async function verifyAdminCredentials(username: string, password: string) {
  if (username !== adminUsername()) return false;
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) return bcrypt.compare(password, hash);
  return process.env.NODE_ENV !== "production" && password === "milkfrog";
}

export async function createAdminSession(username = adminUsername()) {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyAdminSession(token: string | undefined) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === "admin" && payload.sub === adminUsername();
  } catch {
    return false;
  }
}

export const adminCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
