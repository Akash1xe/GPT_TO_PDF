import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";
import { renderConversation, safePdfTitle } from "../src/lib/pdf/conversation-renderer.ts";
import { buildPrintStyles } from "../src/lib/pdf/print-styles.ts";
import { resolvePdfAppearance } from "../src/lib/pdf/appearance.ts";
import { renderMath } from "../src/lib/pdf/math-renderer.ts";
import { renderImage } from "../src/lib/pdf/image-renderer.ts";
import { preparePrintPayload, PRINT_DOCUMENT, PRINT_READY } from "../src/lib/pdf/print-job.ts";
import { DEFAULT_EXPORT_PREFERENCES } from "../src/lib/conversation/preferences.ts";
import { buildConversationStats } from "../src/lib/conversation/stats.ts";

function documentFixture() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="180"><rect width="100" height="80" fill="#eee"/><text x="8" y="15">Diagram</text></svg>';
  const messages = [
    { id:"user-1",role:"user",order:0,plainText:"Please explain",blocks:[
      {type:"paragraph",children:[{type:"text",text:"Please explain",bold:true}]}
    ]},
    { id:"asst-2",role:"assistant",order:1,plainText:"Here are notes",blocks:[
      {type:"heading",level:2,children:[{type:"text",text:"Algorithm "},{type:"text",text:"notes",italic:true}]},
      {type:"paragraph",children:[{type:"text",text:"Open "},{type:"link",href:"https://example.org/docs",children:[{type:"text",text:"reference"}]},{type:"text",text:" and evaluate "},{type:"math",displayMode:"inline",source:"\\frac{1}{2}",sourceFormat:"latex",fallbackText:"1/2",renderStrategy:"latex"}]},
      {type:"code",code:"const n = 42;\n",source:"dom-highlighted",lineCount:2,hasLongLines:false,maxLineLength:13,tabSize:2,language:"javascript",displayLanguage:"JavaScript",lines:[
        {number:1,plainText:"const n = 42;",tokens:[{text:"const",tokenType:"keyword"},{text:" n = ",tokenType:"plain"},{text:"42",tokenType:"number"},{text:";",tokenType:"punctuation"}]},
        {number:2,plainText:"",tokens:[]}
      ]},
      {type:"table",columnCount:2,rows:[
        {cells:[{header:true,colspan:2,rowspan:1,children:[{type:"text",text:"Results"}]}]},
        {cells:[{header:false,colspan:1,rowspan:1,children:[{type:"text",text:"A"}]},
          {header:false,colspan:1,rowspan:1,children:[{type:"math",displayMode:"inline",source:"x^2",sourceFormat:"latex",fallbackText:"x^2",renderStrategy:"latex"}]}]}
      ]},
      {type:"layout",columns:2,card:true,sourceBackground:"#f8f8f8",sourceBorder:"#888888",columnWidths:"1fr 2fr",blocks:[
        {type:"layout",columns:1,card:false,blocks:[{type:"paragraph",children:[{type:"text",text:"Left",sourceColor:"#24774a"}]}]},
        {type:"layout",columns:1,card:false,blocks:[{type:"control",kind:"checkbox",checked:true,percent:0,text:"[x] Selected"}]}
      ]},
      {type:"image",mediaKind:"svg",sourceType:"data",src:"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg),alt:"Diagram",width:350,height:180,caption:"Figure one"},
      {type:"image",mediaKind:"canvas",sourceType:"unknown",alt:"Missing chart",width:500,height:250},
      {type:"math",displayMode:"block",source:"\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}",sourceFormat:"latex",fallbackText:"matrix",renderStrategy:"latex"},
      {type:"ordered-list",start:3,items:[{blocks:[{type:"paragraph",children:[{type:"text",text:"Third"}]}]}]},
      {type:"blockquote",blocks:[{type:"paragraph",children:[{type:"text",text:"Note"}]}]},
      {type:"horizontal-rule"}
    ]}
  ];
  return { provider:"chatgpt",title:'<Danger> Chart / Algorithms',url:"https://chatgpt.com/c/example",
    capturedUrl:"https://chatgpt.com/c/example",capturedAt:"2026-10-27T12:00:00.000Z",
    messageCount:messages.length,possiblyPartial:true,completeness:{state:"possibly-partial",reason:"unknown",collectedMessages:2},
    messages,stats:buildConversationStats(messages) };
}
const prefs = (changes={})=>({...DEFAULT_EXPORT_PREFERENCES,...changes});
function output(conversation=documentFixture(),preferences=prefs()) {
  const { document }=parseHTML("<html><head></head><body></body></html>");
  const node=renderConversation(document,conversation,preferences);
  document.body.appendChild(node);
  return {document,node,html:document.body.innerHTML};
}

test("document renders two selectable semantic messages and escaped title",()=>{
  const {node,html}=output();
  assert.match(node.className,/export-document/);
  assert.equal(node.querySelectorAll(".message").length,2);
  assert.equal(node.querySelectorAll(".message-role").length,2);
  assert.equal(node.querySelector("h1.document-title").textContent,"<Danger> Chart / Algorithms");
  assert.ok(!html.includes("<Danger>"));
  assert.match(html,/&lt;Danger&gt;/);
  assert.match(html,/Please explain/);
  assert.equal(node.querySelectorAll("h2").length,1);
});

test("styled code tokens and wrapping preserve source and language",()=>{
  const {node}=output();
  const block=node.querySelector(".code-block");
  assert.ok(block);
  assert.ok(block.classList.contains("code-wrap"));
  assert.equal(block.querySelector(".code-label").textContent,"JavaScript");
  assert.equal(block.querySelectorAll(".tok-keyword").length,1);
  assert.equal(block.querySelectorAll(".tok-number").length,1);
  assert.equal(block.querySelector("pre code").textContent,"const n = 42;\n");
  const compact=output(documentFixture(),prefs({wrapCode:false,showCodeLanguage:false}));
  assert.ok(!compact.node.querySelector(".code-block").classList.contains("code-wrap"));
  assert.equal(compact.node.querySelector(".code-label"),null);
});

test("table header, span and link markup remain semantic",()=>{
  const {node}=output();
  const table=node.querySelector("table");
  assert.equal(table.querySelectorAll("tr").length,2);
  assert.equal(table.querySelector("thead th").getAttribute("colspan"),"2");
  assert.match(node.querySelector("a[href]").getAttribute("href"),/^https:\/\//);
  assert.equal(node.querySelector("ol").getAttribute("start"),"3");
  assert.equal(node.querySelectorAll("blockquote").length,1);
  assert.equal(node.querySelectorAll("hr").length,1);
});

test("complex KaTeX inline and block math create non-flat printable markup",()=>{
  const {node}=output();
  assert.equal(node.querySelectorAll(".math").length,3);
  const maths=node.querySelectorAll(".math");
  assert.ok([...maths].some(el=>el.querySelector(".katex")));
  assert.ok(node.querySelector(".math-block"));
});

test("unsupported equation uses an accessible plain text fallback",()=>{
  const {document}=parseHTML("<html><body></body></html>");
  const math=renderMath(document,{type:"math",displayMode:"inline",source:"\\notrealcommand",
      sourceFormat:"latex",fallbackText:"one over two",renderStrategy:"text-fallback"});
  assert.equal(math.getAttribute("aria-label"),"one over two");
  assert.equal(math.querySelector(".math-fallback").textContent,"one over two");
});

test("trusted SVG re-sanitizes before print and blocks malicious event attributes",()=>{
  const {document}=parseHTML("<html><body></body></html>");
  const malicious='<svg width="200" height="100" onload="alert(1)"><script>evil()</script><rect width="100" height="50" fill="red"/></svg>';
  const block={type:"image",mediaKind:"svg",sourceType:"data",src:"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(malicious),alt:"Secure graphic",width:200,height:100};
  const figure=renderImage(document,block);
  const img=figure.querySelector("img");
  assert.ok(img);
  const svg=decodeURIComponent(img.getAttribute("src").split(",").slice(1).join(","));
  assert.doesNotMatch(svg,/onload|<script|evil\(\)/);
  assert.match(svg,/<rect/);
  assert.equal(img.getAttribute("alt"),"Secure graphic");
});

test("media image and fallback both have accessible print appearance",()=>{
  const {node}=output();
  assert.equal(node.querySelectorAll(".media-block").length,2);
  assert.match(node.querySelector(".media-placeholder").textContent,/Missing chart/);
  assert.equal(node.querySelector(".media-block figcaption").textContent,"Figure one");
});

test("visual grid card, static checkbox and text colors are represented",()=>{
  const {node}=output();
  const layout=node.querySelector(".visual-card");
  assert.ok(layout);
  assert.equal(layout.style.display,"grid");
  assert.equal(layout.style.gridTemplateColumns,"1fr 2fr");
  assert.ok(node.querySelector(".visual-checkbox.is-checked"));
  assert.ok(node.querySelector(".source-color"));
});

test("export filters by role and rejects empty selections",()=>{
  const all=documentFixture();
  const assistant=preparePrintPayload(all,prefs({messageFilter:"assistant"}));
  assert.equal(assistant.type,PRINT_DOCUMENT);
  assert.equal(assistant.conversation.messages.length,1);
  assert.equal(assistant.conversation.messages[0].role,"assistant");
  assert.equal(output(assistant.conversation,assistant.preferences).node.querySelectorAll(".message-role").length,0);
  assert.equal(preparePrintPayload(all,prefs({excludeUserMessages:true})).conversation.messages.length,1);
  const onlyUser={...all,messages:[all.messages[0]],messageCount:1,stats:buildConversationStats([all.messages[0]])};
  assert.throws(()=>preparePrintPayload(onlyUser,prefs({messageFilter:"assistant"})),/No printable/);
});

test("invalid content and unsafe inline HTML do not become executable document nodes",()=>{
  const all=documentFixture();
  all.messages[0].blocks[0].children[0].text='<script>alert("XSS")</script>';
  const {html,node}=output(preparePrintPayload(all,prefs()).conversation);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal(node.querySelectorAll("script").length,0);
  assert.throws(()=>preparePrintPayload({...all,url:"javascript:attack()"},prefs()),/Invalid conversation/);
  assert.equal(typeof PRINT_READY,"string");
});

test("appearance respects paper size, fonts, margins, weight and spacing",()=>{
  const a=resolvePdfAppearance(prefs({bodyFontSize:12,codeFontSize:10,marginPreset:"wide",bodyFontFamily:"georgia",messagePadding:"spacious",textWeight:"medium"}));
  assert.equal(a.marginTop,"22mm");
  assert.equal(a.bodyFontSize,"12pt");
  assert.equal(a.codeFontSize,"10pt");
  assert.match(a.bodyFontFamily,/Georgia/);
  assert.equal(a.messagePadding,"15px");
  assert.equal(a.bodyFontWeight,"500");
});

test("generated print CSS has A4/Letter rules and semantic pagination safeguards",()=>{
  for(const size of ["A4","Letter"]){
    const css=buildPrintStyles(prefs({pageSize:size}));
    assert.match(css,new RegExp("@page \\{ size: "+size));
    assert.match(css,/break-inside: avoid-page/);
    assert.match(css,/thead \{ display: table-header-group/);
    assert.match(css,/@media print/);
    assert.match(css,/print-color-adjust: exact/);
    assert.match(css,/--pdf-body-size/);
    assert.match(css,/\.math-block/);
    assert.match(css,/\.tok-keyword/);
    assert.match(css,/\.media-placeholder/);
  }
  assert.match(buildPrintStyles(prefs({pdfTheme:"dark"})),/background: #18181b/);
});

test("user preferences cannot inject arbitrary CSS into print",()=>{
  const payload=preparePrintPayload(documentFixture(),{bodyFontFamily:'x;body{color:red}',pageSize:"<style>",bodyFontSize:500});
  assert.equal(payload.preferences.bodyFontFamily,"system");
  assert.equal(payload.preferences.pageSize,"A4");
  assert.equal(payload.preferences.bodyFontSize,18);
  const css=buildPrintStyles(payload.preferences);
  assert.ok(!css.includes("body{color:red}"));
  assert.ok(!css.includes("<style>"));
});

test("sanitized filename avoids filesystem-reserved punctuation",()=>{
  assert.equal(safePdfTitle('Bad: title / file? * "test"'),"Bad title file test");
  assert.equal(safePdfTitle("<>\\\\|"),"ChatGPT Conversation");
});
