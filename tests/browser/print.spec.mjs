import { test, expect } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { richFixture, longFixture, preferences } from "./fixtures.mjs";

test("a final message that fits the page does not add a blank page from trailing spacing",async({context})=>{
 const conversation=longFixture(1);
 conversation.messages[0].blocks=[{type:"paragraph",children:[{type:"text",text:"FINAL_PAGE_MARKER"}]}];
 const {popup}=await openPrint(context,conversation,preferences({includeTitle:false,includeExportDate:false,marginPreset:"compact",messagePadding:"compact",messageSpacing:"compact",bodyFontSize:8}));
 await popup.addStyleTag({content:'@media print { .message-role {display:none;} .message-body {padding-top:0;} .message-body p {height:calc(297mm - 16mm - 2px);margin:0;} }'});
 const bytes=await popup.pdf({preferCSSPageSize:true});
 const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true});
 const pdf=await task.promise;
 expect(pdf.numPages).toBe(1);
 expect((await (await pdf.getPage(1)).getTextContent()).items.map(item=>item.str).join(" ")).toContain("FINAL_PAGE_MARKER");
 await task.destroy();
});

async function openPrint(context, conversation, settings) {
 const opener=await context.newPage();
 await opener.goto("/");
 await opener.evaluate(({conversation, settings})=>{
  const payload={type:"chatpdf:print-document",conversation,preferences:settings};
  let delivered=false;
  window.addEventListener("message",(event)=>{
   if(event.origin!==location.origin || event.data?.type!=="chatpdf:print-ready" || delivered) return;
   delivered=true;
   event.source.postMessage(payload,location.origin);
  });
  const launch=document.createElement("button");
  launch.id="quality-test-print";
  launch.textContent="Open export preview";
  launch.addEventListener("click",()=>window.open("/print","_blank"));
  document.body.appendChild(launch);
 },{conversation,settings});
 const popupPromise=opener.waitForEvent("popup");
 await opener.locator("#quality-test-print").click();
 const popup=await popupPromise;
 await popup.locator(".export-document").waitFor({timeout:30_000});
 await expect(popup.getByRole("button",{name:"Print / Save as PDF"})).toBeEnabled();
 return {opener,popup};
}
async function saveArtifacts(page,testInfo,label) {
 const dir=testInfo.outputPath("artifacts");
 await mkdir(dir,{recursive:true});
 await page.screenshot({path:join(dir,label+".png"),fullPage:label!=="long-letter"});
 const pdf=await page.pdf({printBackground:true,preferCSSPageSize:true});
 await writeFile(join(dir,label+".pdf"),pdf);
 expect(pdf.subarray(0,5).toString()).toBe("%PDF-");
 expect(pdf.length).toBeGreaterThan(4000);
 const loadingTask=getDocument({data:new Uint8Array(pdf),useSystemFonts:true});
 const doc=await loadingTask.promise;
 const pageTexts=[];
 for(let i=1;i<=doc.numPages;i++){
  const p=await doc.getPage(i);
  const content=await p.getTextContent();
  pageTexts.push(content.items.map(item=>item.str).join(" "));
 }
 const first=await doc.getPage(1);
 const viewport=first.getViewport({scale:1});
 const result={pageTexts,pages:doc.numPages,width:viewport.width,height:viewport.height,bytes:pdf.length};
 await loadingTask.destroy();
 return result;
}

test("real Chromium renders rich conversation and searchable A4 PDF",async({context},testInfo)=>{
 const {opener,popup}=await openPrint(context,richFixture(),preferences());
 await expect(popup.locator(".message")).toHaveCount(2);
 await expect(popup.locator(".math .katex")).toHaveCount(2); // block matrix + inline fraction; table has no extra math
 await expect(popup.locator(".tok-keyword")).toHaveCount(2);
 await expect(popup.locator("thead th[colspan='2']")).toHaveCount(1);
 await expect(popup.locator(".visual-card")).toHaveCount(1);
 await expect(popup.locator(".media-block img")).toHaveCount(2);
 await expect(popup.locator(".visual-checkbox.is-checked")).toHaveCount(1);
 await expect(popup.locator(".media-block img").first()).toHaveJSProperty("complete",true);
 const sizes=await popup.evaluate(()=>({
  document:document.querySelector(".export-document").getBoundingClientRect().width,
  page:document.documentElement.scrollWidth,
  viewport:innerWidth,
  math:document.querySelector(".math-block").getBoundingClientRect().width,
 }));
 expect(sizes.page).toBeLessThanOrEqual(sizes.viewport+2);
 expect(sizes.math).toBeLessThanOrEqual(sizes.document+2);
 const result=await saveArtifacts(popup,testInfo,"rich-a4");
 expect(result.pages).toBeGreaterThanOrEqual(1);
 expect(result.width).toBeCloseTo(595.28,0);
 expect(result.height).toBeCloseTo(841.89,0);
 const all=result.pageTexts.join(" ");
 for(const marker of ["CHUNK9_PDF_RICH_FIDELITY","TABLE_CHUNK9_RESULTS","JavaScript","GRID_LEFT_CHUNK9","GRID_RIGHT_CHUNK9","SVG_DIAGRAM_CHUNK9"]) {
  expect(all).toContain(marker);
 }
 await opener.close();
});

test("120-turn long chat paginates in Letter and retains ordered selectable text",async({context},testInfo)=>{
 const {opener,popup}=await openPrint(context,longFixture(),preferences({pageSize:"Letter",marginPreset:"wide",bodyFontSize:11}));
 await expect(popup.locator(".message")).toHaveCount(120);
 await expect(popup.locator(".table-shell")).toHaveCount(10);
 await popup.emulateMedia({media:"print"});
 const layout=await popup.evaluate(()=>({
  scrollWidth:document.documentElement.scrollWidth,innerWidth,thead:getComputedStyle(document.querySelector("thead")).display,
  headerBreak:getComputedStyle(document.querySelector("h3")).breakAfter
 }));
 expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth+2);
 expect(layout.thead).toBe("table-header-group");
 expect(layout.headerBreak).toMatch(/avoid/);
 const result=await saveArtifacts(popup,testInfo,"long-letter");
 expect(result.pages).toBeGreaterThan(8);
 expect(result.pages).toBeLessThan(80);
 expect(result.width).toBeCloseTo(612,0);
 expect(result.height).toBeCloseTo(792,0);
 expect(result.pageTexts.every(t=>t.trim().length>10)).toBe(true);
 const text=result.pageTexts.join(" ");
 expect(text.indexOf("LONG_CHAT_TURN_001")).toBeGreaterThan(-1);
 expect(text.indexOf("LONG_CHAT_TURN_120")).toBeGreaterThan(text.indexOf("LONG_CHAT_TURN_001"));
 await opener.close();
});

test("dark print theme and missing image placeholder render without clipping",async({context},testInfo)=>{
 const conv=richFixture();
 conv.messages[1].blocks.push({type:"image",mediaKind:"canvas",sourceType:"unknown",width:900,height:500,alt:"Missing canvas pixels"});
 const {opener,popup}=await openPrint(context,conv,preferences({pdfTheme:"dark",pageSize:"A4",codeTheme:"dark"}));
 await expect(popup.locator(".theme-dark")).toHaveCount(1);
 await expect(popup.locator(".media-placeholder")).toContainText("Missing canvas pixels");
 const colors=await popup.evaluate(()=>({
  bg:getComputedStyle(document.querySelector(".export-document")).backgroundColor,
  code:getComputedStyle(document.querySelector(".code-block")).backgroundColor,
 }));
 expect(colors.bg).toBe("rgb(24, 24, 27)");
 expect(colors.code).not.toBe("rgba(0, 0, 0, 0)");
 const pdf=await saveArtifacts(popup,testInfo,"dark-fallback");
 expect(pdf.pageTexts.join(" ")).toContain("Missing canvas pixels");
 await opener.close();
});
