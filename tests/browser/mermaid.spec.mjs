import { test, expect } from "@playwright/test";
import { importPastedContent } from "../../src/lib/import/pasted-content.ts";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const chart=`flowchart TD
 U["Client"] --> L["Load balancer"]
 L --> A["Application server 1"]
 L --> B["Application server 2"]
 A --> C["Cache"]
 B --> C
 A --> D["Database"]
 B --> D`;

async function preview(page,source,theme="light"){
 await page.context().addInitScript(()=>{window.print=()=>{};});
 const {conversation}=importPastedContent("Assistant:\nDiagram:\n\n```mermaid\n"+source+"\n```\n\nScalability: We can add application servers, use caching, and scale the database as demand increases.","markdown");
 await page.route("**/api/shared-link/inspect",route=>route.fulfill({json:{ok:true,canonicalUrl:"https://chatgpt.com/share/6ae00e67-ccd0-83ee-9e89-4dc44c105407",conversionReady:true,retrieval:"complete",conversation,warnings:[],message:"Ready"}}));
 await page.goto("/#inspector");
 await page.locator("#shared-link").fill("https://chatgpt.com/share/6ae00e67-ccd0-83ee-9e89-4dc44c105407");
 await page.getByRole("button",{name:"Convert shared link to PDF"}).click();
 await page.getByLabel("Page theme").selectOption(theme);
 const pending=page.waitForEvent("popup");
 await page.getByRole("button",{name:"Open print preview / Save as PDF"}).click();
 const popup=await pending;
 await expect(popup.getByRole("button",{name:"Print / Save as PDF",exact:true})).toBeEnabled({timeout:60000});
 return popup;
}

for(const theme of ["light","dark"]){
 test(`the user's architecture flowchart renders as selectable vector graphics in ${theme} PDF`,async({page},testInfo)=>{
  const popup=await preview(page,chart,theme);
  await expect(popup.locator(".diagram-block svg")).toHaveCount(1);
  await expect(popup.locator(".diagram-block .node")).toHaveCount(6);
  await expect(popup.locator(".diagram-block .flowchart-link")).toHaveCount(7);
  await expect(popup.locator('[data-diagram-language="mermaid"]')).toHaveCount(0);
  await expect(popup.locator(".diagram-block .node text")).toContainText(["Client","Load balancer",/Application\s*server 1/,/Application\s*server 2/,"Cache","Database"]);
  await popup.locator(".diagram-block").screenshot({path:testInfo.outputPath(`flowchart-${theme}.png`)});
  const pdf=await popup.pdf({path:testInfo.outputPath(`flowchart-${theme}.pdf`),preferCSSPageSize:true,printBackground:true});
  const task=getDocument({data:new Uint8Array(pdf),useSystemFonts:true});
  const doc=await task.promise;
  expect(doc.numPages).toBe(1);
  const text=(await (await doc.getPage(1)).getTextContent()).items.map(item=>item.str).join(" ");
  for(const label of ["Client","Load balancer","Application server 1","Application server 2","Cache","Database","Scalability"])expect(text).toContain(label);
  expect(text).not.toContain("flowchart TD");
  await task.destroy();
 });
}

test("malformed Mermaid keeps its source with a warning and does not prevent printing",async({page})=>{
 const popup=await preview(page,"flowchart TD\nA[broken");
 await expect(popup.locator(".diagram-warning")).toBeVisible();
 await expect(popup.locator("pre code")).toContainText("A[broken");
 await expect(popup.locator(".diagram-block")).toHaveCount(0);
});

test("diagram configuration cannot enable HTML or callbacks",async({page})=>{
 const popup=await preview(page,'%%{init: {"securityLevel":"loose"}}%%\nflowchart TD\nA[Client] --> B[Database]');
 await expect(popup.locator(".diagram-warning")).toBeVisible();
 await expect(popup.locator(".diagram-block")).toHaveCount(0);
});

test("diagram image syntax cannot fetch third-party assets while rendering",async({page,context})=>{
 let outbound=0;
 await context.route("https://diagram-assets.example/**",route=>{outbound++;return route.abort();});
 const popup=await preview(page,'flowchart TD\nA@{ img: "https://diagram-assets.example/tracker.png", label: "Client" }');
 await expect(popup.locator(".diagram-warning")).toBeVisible();
 expect(outbound).toBe(0);
});
