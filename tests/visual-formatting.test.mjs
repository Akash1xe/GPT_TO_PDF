import test from "node:test";
import assert from "node:assert/strict";
import { extractChatGPTConversationFromHtml } from "../src/lib/extractors/chatgpt-html-extractor.ts";
import { parseConversationData } from "../src/lib/conversation/validation.ts";

function parse(html) {
  const result = extractChatGPTConversationFromHtml(
    '<article data-message-author-role="assistant">' + html + '</article>',
    { capturedAt: "2026-10-27T09:00:00.000Z" }
  );
  assert.ok(result.conversation, JSON.stringify(result.warnings));
  assert.equal(parseConversationData(result.conversation).ok, true);
  return result.conversation.messages[0].blocks;
}

test("an explicitly styled card retains background, border, and semantic children", () => {
  const blocks = parse('<section style="background-color:rgb(19, 32, 43);border:1px solid rgb(45, 78, 99);text-align:center"><h3>Revenue</h3><p>Up 18%</p></section>');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "layout");
  assert.equal(blocks[0].columns, 1);
  assert.equal(blocks[0].card, true);
  assert.equal(blocks[0].sourceBackground, "rgb(19, 32, 43)");
  assert.equal(blocks[0].sourceBorder, "rgb(45, 78, 99)");
  assert.equal(blocks[0].sourceAlign, "center");
  assert.deepEqual(blocks[0].blocks.map(b => b.type), ["heading", "paragraph"]);
});

test("inline CSS grid tracks preserve up to four columns and width ratios", () => {
  const blocks = parse('<div style="display:grid;grid-template-columns:1fr 2fr"><div><h4>Left</h4></div><div><p>Right</p></div></div>');
  assert.equal(blocks[0].type, "layout");
  assert.equal(blocks[0].columns, 2);
  assert.equal(blocks[0].columnWidths, "1fr 2fr");
  assert.deepEqual(blocks[0].blocks.map(b => b.type), ["layout", "layout"]);
  assert.equal(blocks[0].blocks[0].blocks[0].type, "heading");
  assert.equal(blocks[0].blocks[1].blocks[0].type, "paragraph");
});

test("explicit repeat grid notation is accepted, not calc or arbitrary CSS injection", () => {
  const good = parse('<div style="display:grid;grid-template-columns:repeat(3, 1fr)"><p>A</p><p>B</p><p>C</p></div>')[0];
  assert.equal(good.columns, 3);
  assert.equal(good.columnWidths, "1fr 1fr 1fr");
  const bad = parse('<div style="display:grid;grid-template-columns:repeat(2, calc(100% + 1px))"><p>A</p><p>B</p></div>');
  assert.deepEqual(bad.map(x=>x.type), ["paragraph", "paragraph"]);
});

test("class-driven grid and row flex preserve available structure, without invented colors", () => {
  const grid = parse('<div class="grid grid-cols-2"><div>One</div><div>Two</div></div>')[0];
  assert.equal(grid.columns, 2);
  assert.equal(grid.columnWidths, undefined);
  assert.equal(grid.sourceBackground, undefined);
  const flex = parse('<section style="display:flex;flex-direction:row"><div style="width:120px">A</div><div style="width:240px">B</div></section>')[0];
  assert.equal(flex.columns, 2);
  assert.equal(flex.columnWidths, "120fr 240fr");
});

test("flex column keeps vertical flow, not a fake multi-column layout", () => {
  const blocks = parse('<div style="display:flex;flex-direction:column"><p>Top</p><p>Bottom</p></div>');
  assert.deepEqual(blocks.map(b => b.type), ["paragraph", "paragraph"]);
});

test("inline colored text retains valid source color and ancestor surface", () => {
  const blocks = parse('<section style="background-color:#112233"><p>Normal <span style="color:rgb(12, 150, 99)">Green</span> and <strong>bold</strong></p></section>');
  const layout = blocks[0];
  assert.equal(layout.type, "layout");
  assert.equal(layout.sourceBackground, "#112233");
  const parts = layout.blocks[0].children;
  const tinted = parts.find(node => node.type === "text" && node.text.includes("Green"));
  assert.equal(tinted.sourceColor, "rgb(12, 150, 99)");
  assert.equal(tinted.sourceSurface, "#112233");
  assert.equal(parts.find(node => node.type === "text" && node.bold).text, "bold");
});

test("adjacent text with different source colors remains separate", () => {
  const para = parse('<p><span style="color:#ff0000">Red</span><span style="color:#0000ff">Blue</span></p>')[0];
  assert.equal(para.children.length, 2);
  assert.equal(para.children[0].sourceColor, "#ff0000");
  assert.equal(para.children[1].sourceColor, "#0000ff");
});

test("malicious styling and unsupported gradients do not enter typed color fields", () => {
  const blocks = parse('<div style="background:url(https://bad.test/track);border-color:red;display:grid;grid-template-columns:1fr 1fr"><p><span style="color:expression(alert(1));background:linear-gradient(red,blue)">Safe</span></p><p>Second</p></div>');
  assert.equal(blocks[0].type, "layout");
  assert.equal(blocks[0].sourceBackground, undefined);
  const text = blocks[0].blocks[0].blocks[0].children[0];
  assert.equal(text.sourceColor, undefined);
  assert.equal(text.sourceSurface, undefined);
  assert.equal(blocks[0].columns, 2);
});

test("checked checkbox and radio input are static controls, preserving labels", () => {
  const blocks = parse('<label><input type="checkbox" checked> Keep images</label><input type="radio" aria-label="Option B">');
  assert.deepEqual(blocks.map(b => b.type), ["control", "control"]);
  assert.equal(blocks[0].kind, "checkbox");
  assert.equal(blocks[0].checked, true);
  assert.match(blocks[0].text, /\[x\] Keep images/);
  assert.equal(blocks[1].kind, "radio");
  assert.equal(blocks[1].checked, false);
  assert.match(blocks[1].text, /Option B/);
});

test("progress bar, slider and switch retain percentage and state", () => {
  const blocks = parse('<progress aria-label="Upload" value="30" max="120"></progress><input type="range" aria-label="Volume" value="40" min="0" max="80"><div role="switch" aria-label="Enable" aria-checked="true">Enable</div>');
  assert.equal(blocks[0].kind, "progress");
  assert.equal(blocks[0].percent, 25);
  assert.equal(blocks[1].kind, "slider");
  assert.equal(blocks[1].percent, 50);
  assert.equal(blocks[2].kind, "checkbox");
  assert.equal(blocks[2].checked, true);
});

test("role controls and a bounded CSS-only progress bar are recognized", () => {
  const blocks = parse('<div role="checkbox" aria-checked="false">Read</div><div role="progressbar" aria-valuemin="10" aria-valuemax="110" aria-valuenow="60">Halfway</div><div style="height:12px;background-color:#ccc"><div style="width:75%"></div></div>');
  assert.deepEqual(blocks.map(b => b.type), ["control", "control", "control"]);
  assert.equal(blocks[1].percent, 50);
  assert.equal(blocks[2].percent, 75);
});

test("allowlisted action buttons appear, copying/navigation buttons stay excluded", () => {
  const blocks = parse('<button>Check answer</button><button>Copy</button><nav><button>Download</button></nav><div role="button">Download PDF</div><p>End.</p>');
  assert.deepEqual(blocks.map(b=>b.type), ["control", "control", "paragraph"]);
  assert.equal(blocks[0].text, "Check answer");
  assert.equal(blocks[1].text, "Download PDF");
});

test("password and ordinary text inputs are never represented or read", () => {
  const blocks = parse('<p>Before</p><input type="password" value="my-secret"><input type="text" value="private-message"><input type="hidden" value="another-secret"><p>After</p>');
  assert.deepEqual(blocks.map(b=>b.type), ["paragraph", "paragraph"]);
  assert.doesNotMatch(JSON.stringify(blocks), /my-secret|private-message|another-secret/);
});

test("inline controls between text become standalone control blocks", () => {
  const blocks = parse('<p>Do you agree? <input type="checkbox" checked aria-label="Yes"> Continue.</p>');
  assert.deepEqual(blocks.map(b=>b.type), ["paragraph", "control", "paragraph"]);
  assert.equal(blocks[1].checked, true);
});

test("nested layouts with tables, math, code, and media remain compatible", () => {
  const blocks = parse('<section style="border:1px solid #aaa;background:#fdfdfd"><div class="grid grid-cols-2"><div><table><tr><td>A</td></tr></table></div><div><pre><code class="language-cpp">int n = 1;</code></pre><p><span data-tex="x^2"></span></p><img width="150" height="90" alt="Chart" src="https://example.org/chart.png"></div></div></section>');
  assert.equal(blocks[0].type, "layout");
  assert.equal(blocks[0].blocks[0].columns, 2);
  assert.equal(blocks[0].blocks[0].blocks[0].blocks[0].type, "table");
  assert.equal(blocks[0].blocks[0].blocks[1].blocks[0].type, "code");
  assert.equal(blocks[0].blocks[0].blocks[1].blocks[1].type, "paragraph");
  assert.equal(blocks[0].blocks[0].blocks[1].blocks[2].type, "image");
});
