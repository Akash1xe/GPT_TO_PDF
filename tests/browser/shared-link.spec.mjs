import { test, expect } from "@playwright/test";
import { importExportedConversation } from "../../src/lib/import/export-conversation.ts";

test("shared-link import connects message review to a real printable PDF", async ({page,context}, testInfo) => {
  await context.addInitScript(()=>{window.print=()=>{};});
  const url="https://chatgpt.com/share/6ae00e67-ccd0-83ee-9e89-4dc44c105407";
  const {conversation}=importExportedConversation({title:"Shared link PDF",current_node:"a",mapping:{
    u:{parent:null,message:{id:"u",author:{role:"user"},content:{parts:["Explain a loop"]}}},
    a:{parent:"u",message:{id:"a",author:{role:"assistant"},content:{parts:["## Example\n\n1. First step\n2. Second step\n\n- A bullet\n\n```js\nfor (let i = 0; i < 3; i++) {}\n```"]}}},
  }});
  conversation.url=url;
  await page.route("**/api/shared-link/inspect",async route=>{
    expect(route.request().postDataJSON()).toEqual({url,retrieve:true});
    await route.fulfill({json:{ok:true,canonicalUrl:url,conversionReady:true,retrieval:"complete",conversation,warnings:[],message:"Conversation imported."}});
  });
  await page.goto("/#inspector");
  await page.locator("#shared-link").fill(url);
  await page.getByRole("button",{name:"Convert shared link to PDF"}).click();
  await expect(page.getByText("Conversation ready",{exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Shared link PDF"})).toBeVisible();
  const popupPromise=page.waitForEvent("popup");
  await page.getByRole("button",{name:"Open print preview / Save as PDF"}).click();
  const popup=await popupPromise;
  await expect(popup.locator(".export-document .message")).toHaveCount(2);
  await expect(popup.locator(".export-document .code-block")).toHaveCount(1);
  await expect(popup.locator(".export-document ol")).toHaveCSS("list-style-type","decimal");
  await expect(popup.locator(".export-document ul")).toHaveCSS("list-style-type","disc");
  await popup.getByRole("button",{name:"Print / Save as PDF",exact:true}).click();
  await expect(popup).toHaveTitle("Shared link PDF");
  const pdf=await popup.pdf({path:testInfo.outputPath("shared-link.pdf"),preferCSSPageSize:true});
  expect(pdf.length).toBeGreaterThan(5000);
  await page.locator("#shared-link").fill(url+"?different");
  await expect(page.getByRole("button",{name:"Open print preview / Save as PDF"})).toHaveCount(0);
});
