import { afterEach, describe, expect, it, vi } from "vitest";

const blobMocks = vi.hoisted(() => ({
  isBlobConfigured: vi.fn(() => true),
  listBlobs: vi.fn(),
  readBlobJson: vi.fn(),
  readBlobJsonWithMeta: vi.fn(),
  writeBlobJson: vi.fn(),
}));

vi.mock("@/lib/blob", () => blobMocks);

import { listFeedback } from "@/lib/content/repository";

describe("feedback repository", () => {
  const previousDataSource = process.env.MUSEUM_DATA_SOURCE;

  afterEach(() => {
    vi.clearAllMocks();
    if (previousDataSource === undefined) delete process.env.MUSEUM_DATA_SOURCE;
    else process.env.MUSEUM_DATA_SOURCE = previousDataSource;
  });

  it("does not parse private attachment blobs as feedback records", async () => {
    process.env.MUSEUM_DATA_SOURCE = "blob";
    const record = {
      id: "feedback-1",
      message: "希望增加夜间开放。",
      attachments: [{
        id: "image.png",
        pathname: "feedback/feedback-1/image.png",
        filename: "image.png",
        contentType: "image/png",
        size: 128,
      }],
      status: "new" as const,
      createdAt: "2026-08-30T00:00:00.000Z",
      updatedAt: "2026-08-30T00:00:00.000Z",
    };

    blobMocks.listBlobs.mockResolvedValue([
      { pathname: "feedback/feedback-1.json" },
      { pathname: "feedback/feedback-1/image.png" },
      { pathname: "feedback/feedback-1/attachment.json" },
    ]);
    blobMocks.readBlobJson.mockImplementation(async (pathname: string) => {
      if (pathname === "feedback/feedback-1.json") return record;
      throw new Error("binary attachment should not be parsed");
    });

    await expect(listFeedback()).resolves.toEqual([record]);
    expect(blobMocks.readBlobJson).toHaveBeenCalledTimes(1);
    expect(blobMocks.readBlobJson).toHaveBeenCalledWith("feedback/feedback-1.json", "private");
  });
});
