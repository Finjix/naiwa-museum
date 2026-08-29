import { afterEach, describe, expect, it } from "vitest";
import { sameOrigin } from "@/lib/security";

describe("same-origin write protection", () => {
  const previousOrigin = process.env.MUSEUM_PUBLIC_ORIGIN;

  afterEach(() => {
    if (previousOrigin === undefined) delete process.env.MUSEUM_PUBLIC_ORIGIN;
    else process.env.MUSEUM_PUBLIC_ORIGIN = previousOrigin;
  });

  it("accepts a browser origin matching the forwarded host", () => {
    const request = new Request("http://localhost:3100/api/admin/auth/login", {
      headers: {
        host: "127.0.0.1:3100",
        origin: "http://127.0.0.1:3100",
      },
    });
    expect(sameOrigin(request)).toBe(true);
  });

  it("rejects a different origin", () => {
    const request = new Request("http://localhost:3100/api/admin/auth/login", {
      headers: {
        host: "127.0.0.1:3100",
        origin: "https://attacker.example",
      },
    });
    expect(sameOrigin(request)).toBe(false);
  });

  it("allows the explicitly configured public origin", () => {
    process.env.MUSEUM_PUBLIC_ORIGIN = "https://museum.example";
    const request = new Request("http://localhost:3100/api/admin/auth/login", {
      headers: { origin: "https://museum.example" },
    });
    expect(sameOrigin(request)).toBe(true);
  });
});
