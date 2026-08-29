import { describe, expect, it } from "vitest";
import seed from "@/data/legacy-seed.json";
import { parseContentDocument } from "@/lib/content/schema";
import { getDraftContent, saveDraft } from "@/lib/content/repository";
import { filterWorks, paginate, referencedAssetIds, visibleWorks } from "@/lib/content/utils";

const document = parseContentDocument(seed);

describe("museum content utilities", () => {
  it("keeps the extracted collection counts", () => {
    expect(visibleWorks(document, "western")).toHaveLength(45);
    expect(visibleWorks(document, "china")).toHaveLength(10);
  });

  it("filters by era and paginates six works at a time", () => {
    const works = visibleWorks(document, "western");
    const filtered = filterWorks(works, "baroque");
    expect(filtered).toHaveLength(6);
    expect(paginate(works, 99, 6).page).toBe(8);
    expect(paginate(works, 1, 6).items).toHaveLength(6);
  });

  it("finds references that must block media deletion", () => {
    const refs = referencedAssetIds(document);
    expect(refs.has(document.works[0].primaryAssetId)).toBe(true);
    expect(refs.has(document.site.heroVideoAssetId || "")).toBe(true);
  });

  it("rejects a stale content revision before writing", async () => {
    const current = await getDraftContent();
    await expect(saveDraft(current, current.revision + 1)).rejects.toMatchObject({
      name: "RevisionConflictError",
      currentRevision: current.revision,
    });
  });
});
