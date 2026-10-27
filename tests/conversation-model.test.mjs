import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConversationStats, parseConversationData, parseConversationDocument,
  createConversationDocument, normalizeExportPreferences,
  filterConversationForExport, DEFAULT_EXPORT_PREFERENCES,
} from "../src/lib/conversation/index.ts";

const math = (displayMode = "block") => ({
  type: "math", displayMode, source: "x^2", sourceFormat: "latex",
  fallbackText: "x^2", renderStrategy: "latex", sourceLength: 3,
});
function fixture() {
  const messages = [
    { id:"u1", role:"user", order:0, plainText:"Explain", blocks:[
      { type:"paragraph", children:[{ type:"text", text:"Explain", bold:true }] }
    ] },
    { id:"a1", role:"assistant", order:1, plainText:"Answer", identityQuality:"strong", sourceOrder:1, blocks:[
      { type:"heading", level:2, children:[{ type:"text", text:"Answer", sourceColor:"rgb(10, 90, 60)" }] },
      { type:"paragraph", children:[
        { type:"text", text:"See " },
        { type:"link", href:"https://example.com/reference", children:[
          { type:"text", text:"docs" }, math("inline")
        ] }
      ] },
      { type:"code", language:"cpp", displayLanguage:"C++", code:"int x=1;", source:"dom-highlighted",
        lineCount:1, hasLongLines:false, maxLineLength:8, tabSize:4,
        lines:[{ number:1, plainText:"int x=1;", tokens:[
          { text:"int", tokenType:"type" }, { text:" x=1;", tokenType:"plain" }
        ] }]
      },
      { type:"table", columnCount:2, rows:[{ cells:[
        { header:true, colspan:1, rowspan:1, children:[{ type:"text",text:"Label" }] },
        { header:false, colspan:1, rowspan:1, children:[math("inline")] }
      ] }] },
      { type:"layout", columns:2, card:true, sourceBackground:"oklch(20% .04 250)",
        sourceBorder:"rgb(32, 55, 77)", columnWidths:"1fr 1fr", blocks:[
          { type:"image", mediaKind:"svg", sourceType:"data", width:300, height:120,
            alt:"Diagram", src:"data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E" },
          { type:"control",kind:"progress",checked:false,percent:65,text:"Progress: 65%" }
        ]
      },
      { type:"ordered-list", start:1, items:[
        { blocks:[{ type:"blockquote", blocks:[math()] }] },
        { blocks:[{ type:"unordered-list",items:[{ blocks:[{ type:"horizontal-rule" }] }] }] }
      ] }
    ] }
  ];
  return { provider:"chatgpt", title:"Rich Conversation", url:"https://chatgpt.com/c/123",
    capturedUrl:"https://chatgpt.com/c/123", capturedAt:"2026-10-26T10:00:00.000Z",
    messageCount:2, possiblyPartial:false, completeness:{
      state:"complete", collectedMessages:2, verifiedBeginning:true,
      verifiedEnd:true, continuityVerified:true
    }, messages, stats:buildConversationStats(messages) };
}

test("extension-compatible rich content is preserved and counted recursively", () => {
  const result = parseConversationData(fixture());
  assert.equal(result.ok, true, JSON.stringify(result.ok ? result.warnings : result.issues));
  assert.equal(result.data.messages[1].blocks[4].type, "layout");
  assert.equal(result.data.messages[1].blocks[3].rows[0].cells[1].children[0].type, "math");
  assert.equal(result.data.messages[1].blocks[2].lines[0].tokens[0].tokenType, "type");
  assert.equal(result.data.messages[1].blocks[4].blocks[0].mediaKind, "svg");
  assert.match(result.warnings.join(" "), /embedded SVG must be sanitized/);
  assert.deepEqual(result.data.stats,
    { totalMessages:2, userMessages:1, assistantMessages:1, codeBlocks:1, mathNodes:3, images:1 });
});

test("versioned model roundtrips with JSON-compatible data", () => {
  const value = parseConversationData(fixture());
  assert.equal(value.ok, true);
  const envelope = createConversationDocument(value.data);
  const result = parseConversationDocument(JSON.parse(JSON.stringify(envelope)));
  assert.equal(result.ok, true);
  assert.equal(result.data.schemaVersion, 1);
  assert.equal(result.data.conversation.messages.length, 2);
  assert.equal(parseConversationDocument({schemaVersion:99,conversation:fixture()}).ok,false);
});

test("derives counts, order and completeness flags from validated messages", () => {
  const value = fixture();
  value.stats.images=999; value.messageCount=99;
  value.completeness.collectedMessages=99;
  value.messages[1].order=9;
  value.possiblyPartial=true;
  const result=parseConversationData(value);
  assert.equal(result.ok,true);
  assert.equal(result.data.stats.images,1);
  assert.equal(result.data.messageCount,2);
  assert.equal(result.data.messages[1].order,1);
  assert.equal(result.data.possiblyPartial,false);
  assert.ok(result.warnings.length>=4);
});

test("rejects malicious URLs and CSS, unknown blocks, duplicate IDs and roles", () => {
  const cases=[
    [m=>{m.messages[1].blocks[0].type="raw-html"}, ".type"],
    [m=>{m.messages[0].role="system"}, ".role"],
    [m=>{m.messages[1].id="u1"}, ".id"],
    [m=>{m.messages[1].blocks[1].children[1].href="javascript:alert(1)"}, ".href"],
    [m=>{m.messages[1].blocks[4].sourceBackground="url(https://evil.test/)"}, ".sourceBackground"],
    [m=>{m.messages[1].blocks[4].columnWidths="1fr; color:red"}, ".columnWidths"],
    [m=>{m.messages[1].blocks[4].blocks[0].src="javascript:alert(1)"}, ".src"],
    [m=>{m.url="file:///etc/passwd"}, ".url"],
  ];
  for (const [mutate, suffix] of cases) {
    const value=fixture(); mutate(value);
    const result=parseConversationData(value);
    assert.equal(result.ok,false,suffix);
    assert.ok(result.issues[0].path.endsWith(suffix),result.issues[0].path);
  }
});

test("bounds nesting depth, including on cyclic objects", () => {
  const value=fixture();
  let nested=value.messages[1].blocks[0];
  for(let i=0;i<45;i++) nested={type:"blockquote",blocks:[nested]};
  value.messages[1].blocks=[nested];
  const fail=parseConversationData(value);
  assert.equal(fail.ok,false);
  assert.match(fail.issues[0].message,/deeply/);
  const cyclic=fixture();
  const loop={type:"blockquote",blocks:[]};
  loop.blocks.push(loop);
  cyclic.messages[1].blocks=[loop];
  assert.equal(parseConversationData(cyclic).ok,false);
});

test("resolves relative but safe links", () => {
  const value=fixture();
  value.messages[1].blocks[1].children[1].href="/share/example";
  const result=parseConversationData(value);
  assert.equal(result.ok,true);
  assert.equal(result.data.messages[1].blocks[1].children[1].href,"https://chatgpt.com/share/example");
});

test("rejects untrusted style and clamps preferences to print-safe limits", () => {
  const result=normalizeExportPreferences({
    pdfTheme:"evil()",bodyFontFamily:"url(script)",textWeight:"hacker",
    bodyFontSize:999,codeFontSize:-5,customMargins:{top:-1,right:500},
    includeSourceUrl:true,excludeUserMessages:true
  });
  assert.equal(result.data.pdfTheme,"light");
  assert.equal(result.data.bodyFontFamily,"system");
  assert.equal(result.data.bodyFontSize,18);
  assert.equal(result.data.codeFontSize,8);
  assert.equal(result.data.customMargins.top,5);
  assert.equal(result.data.customMargins.right,40);
  assert.equal(result.data.excludeUserMessages,true);
  assert.equal(result.data.includeSourceUrl,true);
  assert.ok(result.warnings.length>=6);
  assert.deepEqual(normalizeExportPreferences(null).data,DEFAULT_EXPORT_PREFERENCES);
});

test("assistant-only filtering preserves original conversation and recomputes statistics", () => {
  const original=fixture();
  const filtered=filterConversationForExport(original,
    {...DEFAULT_EXPORT_PREFERENCES,excludeUserMessages:true});
  assert.equal(filtered.messages.length,1);
  assert.equal(filtered.messages[0].order,0);
  assert.equal(filtered.stats.totalMessages,1);
  assert.equal(filtered.stats.codeBlocks,1);
  assert.equal(filtered.completeness.state,"complete");
  assert.equal(original.messages.length,2);
});
