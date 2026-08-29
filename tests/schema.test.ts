import { describe, expect, it } from "vitest";
import seed from "@/data/legacy-seed.json";
import { parseContentDocument } from "@/lib/content/schema";

describe("content schema", () => {
  it("accepts the complete extracted document", () => {
    const parsed = parseContentDocument(seed);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.quiz.questions).toHaveLength(4);
    expect(parsed.quiz.results).toHaveLength(30);
  });

  it("rejects an invalid content version", () => {
    expect(() => parseContentDocument({ ...seed, schemaVersion: 2 })).toThrow();
  });
});
