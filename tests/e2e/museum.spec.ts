import { expect, test } from "@playwright/test";

test.describe("public museum", () => {
  test("renders the collection and opens a work lightbox", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "典藏系列" })).toBeVisible();
    await expect(page.locator(".card")).toHaveCount(6);
    if (isMobile) {
      await expect(page.getByRole("dialog", { name: /进入奶蛙博物馆/ })).toBeVisible();
      await page.getByRole("button", { name: "进入博物馆" }).click();
    }
    await page.getByRole("button", { name: /查看作品/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("作品介绍")).toBeVisible();
  });

  test("supports the China museum and mobile entry", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) {
      await expect(page.getByRole("dialog", { name: /进入奶蛙博物馆/ })).toBeVisible();
      await page.getByRole("button", { name: "进入博物馆" }).click();
    }
    await page.getByRole("button", { name: "参观中国馆" }).first().click();
    await expect(page.getByRole("heading", { name: "中国馆" })).toBeVisible();
    await expect(page.locator(".card")).toHaveCount(6);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});

test.describe("admin", () => {
  test("redirects unauthenticated visitors and accepts the local admin", async ({ page, isMobile }) => {
    test.skip(isMobile, "The authenticated admin flow is covered in the desktop project.");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin/);
    await page.getByLabel("管理员账号").fill("admin");
    await page.getByLabel("密码").fill("wrong");
    await page.getByRole("button", { name: "进入后台" }).click();
    await expect(page.locator(".admin-login-card .admin-missing")).toContainText("用户名或密码错误");
    await page.getByLabel("密码").fill("milkfrog");
    await page.getByRole("button", { name: "进入后台" }).click();
    await expect(page.getByRole("heading", { name: "总览" })).toBeVisible();
    await page.goto("/admin/works");
    await expect(page.getByRole("heading", { name: "展品", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "保存草稿" })).toBeVisible();
  });
});
