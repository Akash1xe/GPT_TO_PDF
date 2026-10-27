import { test, expect } from "@playwright/test";

test("security response headers protect print route and disallow iframe embedding",async({request})=>{
 const response=await request.get("/print");
 expect(response.ok()).toBeTruthy();
 const headers=response.headers();
 expect(headers["x-frame-options"]).toBe("DENY");
 expect(headers["x-content-type-options"]).toBe("nosniff");
 expect(headers["referrer-policy"]).toBe("no-referrer");
 expect(headers["cache-control"]).toContain("no-store");
 expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
 expect(headers["content-security-policy"]).toContain("object-src 'none'");
});

test("a directly visited print tab cannot print without validated conversation data",async({page})=>{
 await page.goto("/print");
 await expect(page.getByRole("button",{name:"Print / Save as PDF"})).toBeDisabled();
 await expect(page.locator(".export-document")).toHaveCount(0);
});

test("an uploaded HTML script stays inert and unsafe image becomes a placeholder",async({page})=>{
 await page.goto("/#import-studio");
 const html='<html><body><article data-role="user"><p>Hello</p></article>'
  +'<article data-role="assistant"><p>SAFE_MESSAGE_ONLY</p><script>window.__uploadedProbe=true</script>'
  +'<img alt="blocked sample" width="400" height="200" src="javascript:alert(1)"></article></body></html>';
 await page.locator("#conversation-file").setInputFiles({
  name:"conversation.html",mimeType:"text/html",buffer:Buffer.from(html)
 });
 await expect(page.getByText("SAFE_MESSAGE_ONLY",{exact:false}).first()).toBeVisible();
 expect(await page.evaluate(()=>window.__uploadedProbe)).toBeUndefined();
 const promise=page.waitForEvent("popup");
 await page.getByRole("button",{name:"Open print preview / Save as PDF"}).click();
 const popup=await promise;
 await expect(popup.locator(".media-placeholder")).toContainText("blocked sample");
 expect(await popup.evaluate(()=>window.__uploadedProbe)).toBeUndefined();
 await popup.close();
});

test("mobile-width Chrome imports TXT and opens PDF preview without horizontal overflow",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#import-studio");
 await page.locator("#conversation-file").setInputFiles({
  name:"mobile.txt",mimeType:"text/plain",
  buffer:Buffer.from("User:\nCan you export this?\n\nAssistant:\nMOBILE_IMPORT_SAFE\nNo scripts.")
 });
 await expect(page.getByText("MOBILE_IMPORT_SAFE",{exact:false}).first()).toBeVisible();
 const popupPromise=page.waitForEvent("popup");
 await page.getByRole("button",{name:"Open print preview / Save as PDF"}).click();
 const popup=await popupPromise;
 await expect(popup.locator(".export-document")).toContainText("MOBILE_IMPORT_SAFE");
 const geometry=await popup.evaluate(()=>({
  documentWidth:document.documentElement.scrollWidth,
  viewportWidth:innerWidth,
 }));
 expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth+2);
 await popup.close();
});
