import { test, expect } from "@playwright/test";
import { rasterPng } from "./fixtures.mjs";

test("privacy page is available and uninitialized print route remains isolated",async({page,request})=>{
 await page.goto("/privacy");
 await expect(page.getByRole("heading",{name:"How your conversations are processed"})).toBeVisible();
 const health=await request.get("/api/health");
 expect((await health.json()).phase).toBe("release-candidate");
 const home=await request.get("/");
 expect(home.headers()["x-frame-options"]).toBe("DENY");
});

test("print does not request external images unless the user opts in",async({page,context})=>{
 let outboundRequests=0;
 const asset="https://assets.example.net/release-canary.png";
 await context.route("**/release-canary.png",async(route)=>{
   outboundRequests++;
   await route.fulfill({
     status:200,
     contentType:"image/png",
     body:Buffer.from(rasterPng.split(",")[1],"base64"),
   });
 });
 await page.goto("/#import-studio");
 await page.locator("#paste-format").selectOption("html");
 await page.locator("#paste-content").fill(
   '<article data-role="assistant"><h2>External media example</h2>'
   +'<img width="350" height="180" alt="External sample" src="'+asset+'"></article>'
 );
 await page.getByRole("button",{name:"Import pasted content"}).click();
 const button=page.getByRole("button",{name:"Open print preview / Save as PDF"});
 await expect(button).toBeVisible();

 const firstPopup=page.waitForEvent("popup");
 await button.click();
 const blocked=await firstPopup;
 await expect(blocked.locator(".media-placeholder")).toContainText("external image not loaded");
 await expect(blocked.locator('.media-block img[src^="https://"]')).toHaveCount(0);
 expect(outboundRequests).toBe(0);
 await blocked.close();

 await page.getByRole("checkbox",{name:/Load external images/}).check();
 const secondPopup=page.waitForEvent("popup");
 await button.click();
 const allowed=await secondPopup;
 await expect(allowed.locator('.media-block img[src^="https://"]')).toHaveCount(1);
 await expect.poll(()=>outboundRequests).toBe(1);
 await allowed.close();
});
