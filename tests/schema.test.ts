import { describe, expect, it } from "vitest";
import seed from "@/data/legacy-seed.json";
import { parseContentDocument } from "@/lib/content/schema";

describe("content schema", () => {
  it("accepts the complete extracted document", () => {
    const parsed = parseContentDocument(seed);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.works).toHaveLength(55);
    expect(parsed.assets).toHaveLength(56);
    expect(parsed.assets.every((asset) => asset.status === "active")).toBe(true);
    expect(parsed.artists.every((artist) => !artist.portraitAssetId || parsed.assets.some((asset) => asset.id === artist.portraitAssetId))).toBe(true);
    expect("quiz" in parsed).toBe(false);
    expect(parsed.assets.some((asset) => asset.pathname.startsWith("assets/context/works/") || asset.pathname.startsWith("assets/quiz/"))).toBe(false);
  });

  it("rejects an invalid content version", () => {
    expect(() => parseContentDocument({ ...seed, schemaVersion: 2 })).toThrow();
  });
});
