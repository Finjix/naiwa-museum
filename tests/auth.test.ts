// @vitest-environment node

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createAdminSession, verifyAdminCredentials, verifyAdminSession } from "@/lib/auth";

describe("admin session", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousHash = process.env.ADMIN_PASSWORD_HASH;

  beforeEach(() => { process.env.NODE_ENV = "test"; delete process.env.ADMIN_PASSWORD_HASH; });
  afterEach(() => { process.env.NODE_ENV = previousNodeEnv; if (previousHash) process.env.ADMIN_PASSWORD_HASH = previousHash; else delete process.env.ADMIN_PASSWORD_HASH; });

  it("supports the local-only development credential", async () => {
    expect(await verifyAdminCredentials("admin", "milkfrog")).toBe(true);
    expect(await verifyAdminCredentials("admin", "wrong")).toBe(false);
  });

  it("signs and verifies an admin session", async () => {
    const token = await createAdminSession();
    expect(await verifyAdminSession(token)).toBe(true);
    expect(await verifyAdminSession(`${token}broken`)).toBe(false);
  });
});
