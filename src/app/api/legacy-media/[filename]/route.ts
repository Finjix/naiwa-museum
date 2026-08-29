import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
};

function isLegacyMediaEnabled() {
  return process.env.MUSEUM_DATA_SOURCE !== "blob" && process.env.NODE_ENV !== "production";
}

function safeFilename(filename: string) {
  return filename.length <= 180 && path.basename(filename) === filename && !/[\\/]/.test(filename) ? filename : null;
}

async function locateMedia(filename: string) {
  const root = process.cwd();
  const legacyDirectory = path.join(root, "奶蛙博物馆 · Musée du Milk Frog_files");
  const candidates = [path.join(legacyDirectory, filename)];
  if (filename === "奶蛙博物馆 · Musée du Milk Frog.mp4") candidates.push(path.join(root, "奶蛙博物馆 · Musée du Milk Frog.mp4"));
  for (const candidate of candidates) {
    try {
      const fileStat = await stat(/* turbopackIgnore: true */ candidate);
      if (fileStat.isFile()) return { candidate, fileStat };
    } catch {
      // Continue to the next legacy media location.
    }
  }
  return null;
}

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  if (!isLegacyMediaEnabled()) return new NextResponse("Not found", { status: 404 });
  const { filename: encodedFilename } = await params;
  const filename = safeFilename(decodeURIComponent(encodedFilename));
  if (!filename) return new NextResponse("Invalid filename", { status: 400 });
  const media = await locateMedia(filename);
  if (!media) return new NextResponse("Not found", { status: 404 });

  const contentType = CONTENT_TYPES[path.extname(filename).toLowerCase()] || "application/octet-stream";
  const range = request.headers.get("range");
  const commonHeaders = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
    "Content-Type": contentType,
  };

  if (!range) {
    return new Response(Readable.toWeb(createReadStream(media.candidate)) as ReadableStream, {
      headers: { ...commonHeaders, "Content-Length": String(media.fileStat.size) },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return new NextResponse("Invalid range", { status: 416 });
  const start = match[1] ? Number(match[1]) : Math.max(0, media.fileStat.size - Number(match[2] || 0));
  const end = match[2] ? Math.min(media.fileStat.size - 1, Number(match[2])) : media.fileStat.size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= media.fileStat.size) {
    return new NextResponse("Range not satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${media.fileStat.size}` },
    });
  }

  const length = end - start + 1;
  return new Response(Readable.toWeb(createReadStream(media.candidate, { start, end })) as ReadableStream, {
    status: 206,
    headers: {
      ...commonHeaders,
      "Content-Length": String(length),
      "Content-Range": `bytes ${start}-${end}/${media.fileStat.size}`,
    },
  });
}
