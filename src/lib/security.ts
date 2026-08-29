export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const configured = process.env.MUSEUM_PUBLIC_ORIGIN;
    if (configured && origin === configured) return true;

    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const expectedProtocol = forwardedProtocol ? `${forwardedProtocol}:` : requestUrl.protocol;
    const expectedHost = forwardedHost || request.headers.get("host") || requestUrl.host;
    return originUrl.protocol === expectedProtocol && originUrl.host === expectedHost;
  } catch {
    return false;
  }
}

export function safePathSegment(value: string) {
  return /^[a-zA-Z0-9._-]+$/.test(value) && !value.includes(".." ) ? value : null;
}

export function safeUploadName(value: string) {
  const basename = value.split(/[\\/]/).pop() || "upload";
  const cleaned = basename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 120) || "upload";
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
