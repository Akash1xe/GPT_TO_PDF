import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { safeDiagramSvg, renderMermaidDiagrams } from "../src/lib/pdf/mermaid-renderer.ts";
import { renderCodeBlock } from "../src/lib/pdf/code-renderer.ts";
import { DEFAULT_EXPORT_PREFERENCES } from "../src/lib/conversation/preferences.ts";
import { parseRichMarkdown } from "../src/lib/import/markdown.ts";

test("Mermaid code fences retain exact source and are discoverable by the print renderer",()=>{
 const {document}=parseHTML("<html><body></body></html>");
 const source='flowchart TD\n A["Client"] --> B["Load balancer"]';
 const {blocks}=parseRichMarkdown('```mermaid\n'+source+'\n```');
 const figure=renderCodeBlock(document,blocks[0],DEFAULT_EXPORT_PREFERENCES);
 assert.equal(figure.dataset.diagramLanguage,"mermaid");
 assert.equal(figure.querySelector("pre code").textContent.trim(),source);
});

test("SVG labels and local arrow markers survive, while active content and remote resources are removed",()=>{
 const {document}=parseHTML("<html><body></body></html>");
 const svg=safeDiagramSvg(document,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" onload="alert(1)">
 <style>#chart .edge {marker-end:url('#arrow')}</style>
 <defs><marker id="arrow"><path d="M0,0L5,5"/></marker></defs>
 <script>alert(1)</script><foreignObject><p>unsafe HTML</p></foreignObject>
 <image href="https://evil.example/track"/><a href="javascript:alert(1)"><text>Client</text></a>
 <path marker-end="url(#arrow)" onclick="bad()"/><use href="#arrow"/>
 <style>@import 'https://evil.example/styles';</style>
 </svg>`);
 assert.equal(svg.textContent.includes("Client"),true);
 assert.equal(svg.querySelectorAll("script,foreignObject,image,a").length,0);
 assert.equal(svg.querySelector("path[marker-end]").getAttribute("marker-end"),"url(#arrow)");
 assert.equal(svg.querySelector("use").getAttribute("href"),"#arrow");
 assert.equal(svg.querySelectorAll("style").length,1);
 assert.doesNotMatch(svg.outerHTML,/onload|onclick|evil\.example|javascript:/);
});

test("documents without Mermaid do not need a browser or load the diagram library",async()=>{
 const {document}=parseHTML("<html><body><main><p>Plain conversation</p></main></body></html>");
 assert.deepEqual(await renderMermaidDiagrams(document.querySelector("main"),"light"),{rendered:0,failed:0});
});
