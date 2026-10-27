import { test, expect } from "@playwright/test";

const share = "https://chatgpt.com/share/6adfb5d3-f814-83ee-9e27-ae27a037d94f";
const snapshot = `<!doctype html><html><head><title>Captured Algorithms - ChatGPT</title>
<meta name='chatpdf-capture-source' content='${share}'></head><body><main>
<article data-message-author-role="user" data-message-id="u-1"><p>Write a loop in C++.</p></article>
<article data-message-author-role="assistant" data-message-id="a-1"><h2>Loop example</h2>
<pre><code class="language-cpp">for(int i=0;i&lt;3;i++) {}</code></pre></article>
</main></body></html>`;

test.beforeEach(async ({page}) => {
  await page.route("**/api/shared-link/inspect", async route => {
    const {url} = route.request().postDataJSON();
    await route.fulfill({status:422,json:{ok:true,canonicalUrl:url,conversionReady:false,retrieval:"failed",message:"ChatGPT blocked automatic access. Use capture below."}});
  });
});

test("a validated share snapshot imports from clipboard and opens rich PDF preview", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:3100" });
  await page.goto("/#inspector");
  await page.locator("#shared-link").fill(share);
  await page.getByRole("button", { name: "Convert shared link to PDF" }).click();
  await expect(page.getByText("Automatic import unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText("Capture ChatGPT (drag to bookmarks)")).toBeVisible();

  await page.evaluate(text => navigator.clipboard.writeText(text), snapshot);
  await page.getByRole("button", { name: "Import captured conversation" }).click();
  await expect(page.getByText("Structured conversation extracted (partial snapshot)")).toBeVisible();
  await expect(page.getByText("Write a loop in C++.", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Loop example", { exact: false }).first()).toBeVisible();

  const print = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Open print preview / Save as PDF" }).click();
  const popup = await print;
  await expect(popup.locator(".export-document .message")).toHaveCount(2);
  await expect(popup.locator(".export-document .code-block")).toHaveCount(1);
  await popup.close();
});

test("clipboard snapshot from a different shared link is rejected", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:3100" });
  await page.goto("/#inspector");
  await page.locator("#shared-link").fill("https://chatgpt.com/share/696ac45b-70d8-8003-9ca4-320151e0816e");
  await page.getByRole("button", { name: "Convert shared link to PDF" }).click();
  await expect(page.getByText("Automatic import unavailable", { exact: true })).toBeVisible();

  await page.evaluate(text => navigator.clipboard.writeText(text), snapshot);
  await page.getByRole("button", { name: "Import captured conversation" }).click();
  await expect(page.getByText(/Clipboard capture is not from the shared link/)).toBeVisible();
  await expect(page.getByText("Structured conversation extracted (partial snapshot)")).toHaveCount(0);
});
