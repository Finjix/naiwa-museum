import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFeedback: vi.fn(),
  getPrivateBlobResponse: vi.fn(),
  isAdminRequest: vi.fn(() => true),
}));

vi.mock("@/lib/blob", () => ({ getPrivateBlobResponse: mocks.getPrivateBlobResponse }));
vi.mock("@/lib/admin", () => ({ isAdminRequest: mocks.isAdminRequest }));
vi.mock("@/lib/content/repository", () => ({ getFeedback: mocks.getFeedback }));

import { GET } from "@/app/api/admin/feedback/[id]/attachment/[attachmentId]/route";

describe("feedback attachment route", () => {
  afterEach(() => vi.clearAllMocks());

  it("streams attachments with Unicode filenames", async () => {
    const filename = "意见截图.png";
    const blobResponse = new Response("attachment-data");
    mocks.getFeedback.mockResolvedValue({
      attachments: [{
        id: "upload-1-yi-jian-tu.png",
        pathname: "feedback/feedback-1/upload-1-yi-jian-tu.png",
        filename,
        contentType: "image/png",
        size: 16,
      }],
    });
    mocks.getPrivateBlobResponse.mockResolvedValue({
      statusCode: 200,
      stream: blobResponse.body,
      headers: new Headers({ "content-type": "image/png" }),
      blob: { contentType: "image/png" },
    });

    const response = await GET(new Request("http://localhost/api/admin/feedback/feedback-1/attachment/upload-1-yi-jian-tu.png"), {
      params: Promise.resolve({ id: "feedback-1", attachmentId: "upload-1-yi-jian-tu.png" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      "inline; filename=\"____.png\"; filename*=UTF-8''%E6%84%8F%E8%A7%81%E6%88%AA%E5%9B%BE.png",
    );
    await expect(response.text()).resolves.toBe("attachment-data");
  });
});
