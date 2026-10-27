import assert from "node:assert/strict";
import test from "node:test";
import { extractChatGPTConversationFromHtml } from "../src/lib/extractors/chatgpt-html-extractor.ts";
import { parseConversationData } from "../src/lib/conversation/validation.ts";
import { parseHtmlTree, descendants, tag } from "../src/lib/extractors/html-tree.ts";
import { serializeSafeSvg } from "../src/lib/extractors/chatgpt-media.ts";

const documentHtml = (html) =>
  extractChatGPTConversationFromHtml('<article data-message-author-role="assistant">' + html + '</article>', {
    capturedAt: "2026-10-27T10:00:00.000Z",
  });
const blocks = (html) => documentHtml(html).conversation.messages[0].blocks;

test("remote image preserves source, meaningful alt, dimensions and caption", () => {
  const media = blocks('<figure><img width="640" height="360" alt="Binary search diagram" src="https://example.org/fig.png"><figcaption>Figure 1. Search process</figcaption></figure>')[0];
  assert.equal(media.type, "image");
  assert.equal(media.mediaKind, "image");
  assert.equal(media.sourceType, "remote");
  assert.equal(media.src, "https://example.org/fig.png");
  assert.equal(media.alt, "Binary search diagram");
  assert.equal(media.width, 640);
  assert.equal(media.height, 360);
  assert.equal(media.caption, "Figure 1. Search process");
});

test("keeps prose, media and headings in source order", () => {
  const b=blocks('<h2>Picture</h2><p>Before <b>bold</b> <img alt="Graph" src="https://example.org/g.png"> after</p><p>End</p>');
  assert.deepEqual(b.map((item) => item.type), ["heading", "paragraph", "image", "paragraph", "paragraph"]);
  assert.equal(b[1].children.find((x)=>x.type==="text" && x.bold).text, "bold");
  assert.match(b[3].children.map((n)=>n.text).join(""), /after/);
});

test("nested picture and image with srcset recover an explicit resource", () => {
  const media=blocks('<picture><source srcset="https://example.org/large.png 800w, https://example.org/small.png 300w"><img alt="Landscape" width="480"></picture>')[0];
  assert.equal(media.src, "https://example.org/large.png");
  assert.equal(media.width, 480);
});

test("reads inline image dimensions only from finite pixel values", () => {
  const media=blocks('<p><img alt="Chart" src="/assets/chart.png" style="width:320px;height:180px"></p>')[0];
  assert.equal(media.src, "https://chatgpt.com/assets/chart.png");
  assert.equal(media.width, 320);
  assert.equal(media.height, 180);
});

test("encoded PNG source is retained without any remote fetch", () => {
  const media=blocks('<img alt="Tiny raster sample" width="160" height="90" src="data:image/png;base64,aGVsbG8=">')[0];
  assert.equal(media.sourceType,"data");
  assert.equal(media.src,"data:image/png;base64,aGVsbG8=");
});

test("filters small decorative icons and avatars", () => {
  const extracted=documentHtml('<p>Text <img width="24" height="24" src="https://example.org/icon.png" alt="Logo"> kept</p><p>Visible content.</p>');
  assert.equal(extracted.conversation.stats.images,0);
  assert.doesNotMatch(extracted.conversation.messages[0].plainText, /\[Image/);
  assert.match(extracted.conversation.messages[0].plainText, /Visible content/);
});

test("rejects javascript, file and credential URLs while retaining an accessible placeholder", () => {
  for (const bad of [
    "javascript:alert(1)", "file:///etc/passwd", "https://me:password@example.org/secret",
  ]) {
    const doc=documentHtml('<img alt="Protected figure" width="300" height="200" src="' + bad + '">');
    const block=doc.conversation.messages[0].blocks[0];
    assert.equal(block.type,"image");
    assert.equal(block.src,undefined);
    assert.equal(block.sourceType,"unknown");
    assert.equal(block.alt,"Protected figure");
    assert.ok(doc.warnings.some((warning)=>/placeholder/.test(warning)));
  }
});

test("source-less images are represented rather than disappearing", () => {
  const doc=documentHtml('<p>A <img alt="Missing photo" width="500" height="300"> B</p>');
  assert.deepEqual(doc.conversation.messages[0].blocks.map((item)=>item.type),["paragraph","image","paragraph"]);
  assert.equal(doc.conversation.messages[0].blocks[1].alt,"Missing photo");
  assert.equal(doc.conversation.stats.images,1);
  assert.equal(parseConversationData(doc.conversation).ok,true);
});

test("SVG shapes, path, text, dimensions and safe inline styles survive", () => {
  const doc=documentHtml('<svg viewBox="0 0 400 150" role="img" aria-label="Decision chart"><rect width="180" height="45" x="10" y="10" fill="#e9f2ff"/><path d="M10 20 L80 20" stroke="#333"/><text x="24" y="34" style="font-size:14px;fill:#111">Start</text></svg>');
  const img=doc.conversation.messages[0].blocks[0];
  assert.equal(img.mediaKind,"svg");
  assert.equal(img.width,400);
  assert.equal(img.height,150);
  assert.equal(img.alt,"Decision chart");
  assert.equal(img.sourceType,"data");
  const xml=decodeURIComponent(img.src.slice(img.src.indexOf(",")+1));
  assert.match(xml,/xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(xml,/viewBox="0 0 400 150"/);
  assert.match(xml,/<path/);
  assert.match(xml,/<text/);
  assert.match(xml,/font-size:14px/);
  assert.equal(parseConversationData(doc.conversation).ok,true);
});

test("SVG sanitizer removes foreignObject, scripts, event handlers and external references", () => {
  const doc=documentHtml('<svg viewBox="0 0 300 100" onload="attack()"><rect width="200" height="80" style="fill:blue;background:url(https://attacker.test);stroke:#222" onclick="attack()"/><script>alert(1)</script><foreignObject><div>Stolen HTML</div></foreignObject><image href="https://attacker.test/tracker.png"/><use href="https://attacker.test/a.svg#id"/><text>Safe</text></svg>');
  const svg=decodeURIComponent(doc.conversation.messages[0].blocks[0].src.split(",")[1]);
  assert.match(svg,/<rect/);
  assert.match(svg,/style="fill:blue;stroke:#222"/);
  assert.match(svg,/>Safe<\/text>/);
  assert.doesNotMatch(svg,/onload|onclick|<script|<foreignObject|<image|attacker|alert\(1\)|Stolen HTML/);
  assert.equal(parseConversationData(doc.conversation).ok,true);
});

test("SVG local fragment references retain safe gradients and use nodes", () => {
  const b=blocks('<svg width="320" height="140"><defs><linearGradient id="gradA"><stop offset="0%" stop-color="#fff"/><stop offset="100%" stop-color="#000"/></linearGradient></defs><rect width="320" height="140" fill="url(#gradA)"/><use href="#shape1"/></svg>')[0];
  const xml=decodeURIComponent(b.src.split(",")[1]);
  assert.match(xml,/fill="url\(#gradA\)"/);
  assert.match(xml,/<lineargradient/);
  assert.match(xml,/href="#shape1"/);
});

test("malformed svg data image never enters document unsanitized", () => {
  const original='<svg viewBox="0 0 300 150"><script>bad()</script><rect width="100" height="100" fill="red"/></svg>';
  const uri="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(original);
  const html='<img alt="Input SVG" width="300" height="150" src="'+uri+'">';
  const block=blocks(html)[0];
  assert.equal(block.sourceType,"data");
  const xml=decodeURIComponent(block.src.slice(block.src.indexOf(",")+1));
  assert.doesNotMatch(xml,/script|bad/);
  assert.match(xml,/<rect/);
});

test("canvas without an explicit screenshot keeps dimensions, alt and warning", () => {
  const doc=documentHtml('<canvas width="500" height="250" aria-label="Sales chart"></canvas>');
  const media=doc.conversation.messages[0].blocks[0];
  assert.equal(media.mediaKind,"canvas");
  assert.equal(media.sourceType,"unknown");
  assert.equal(media.src,undefined);
  assert.equal(media.width,500);
  assert.equal(media.height,250);
  assert.equal(media.alt,"Sales chart");
  assert.ok(doc.warnings.some((warning)=>/Canvas pixels cannot be recovered/.test(warning)));
});

test("canvas with explicit user-provided PNG snapshot preserves the raster", () => {
  const block=blocks('<canvas aria-label="Chart with screenshot" width="500" height="250" data-canvas-png="data:image/png;base64,aGVsbG8="></canvas>')[0];
  assert.equal(block.mediaKind,"canvas");
  assert.equal(block.src,"data:image/png;base64,aGVsbG8=");
  assert.equal(block.sourceType,"data");
});

test("rejects non-PNG canvas snapshot data without claiming recovery", () => {
  const doc=documentHtml('<canvas width="400" height="200" data-canvas-data-url="javascript:alert(1)"></canvas>');
  assert.equal(doc.conversation.messages[0].blocks[0].src,undefined);
  assert.ok(doc.warnings.some((w)=>/explicit PNG data URL/.test(w)));
});

test("table cell image remains a labeled textual placeholder until the model supports blocks in cells", () => {
  const doc=documentHtml('<table><tr><td>Value</td><td><img alt="Mini figure" src="https://example.org/plot.png" width="200" height="120"></td></tr></table>');
  const table=doc.conversation.messages[0].blocks[0];
  assert.equal(table.type,"table");
  assert.match(table.rows[0].cells[1].children[0].text, /\[Image: Mini figure\]/);
  assert.ok(doc.warnings.some((w)=>/inline-only context/.test(w)));
});

test("untrusted SVG serialization is bounded and script-free", () => {
  const doc=parseHtmlTree('<svg viewBox="0 0 500 150"><text>Hi</text><style>text{fill:red}</style><a href="https://bad.test/"><text>Unsafe external link</text></a></svg>');
  const svg=descendants(doc,(node)=>tag(node)==="svg")[0];
  const clean=serializeSafeSvg(svg);
  assert.match(clean,/<text>Hi<\/text>/);
  assert.doesNotMatch(clean,/bad.test|<style|<a /);
});

test("KaTeX with SVG glyphs remains one formula, not a separate diagram", () => {
  const doc=documentHtml('<p>Solve <span class="katex" data-latex="x^2"><span class="katex-html"><svg width="90" height="30"><path d="M0 0 L5 5"/></svg></span></span> now.</p>');
  const content=doc.conversation.messages[0].blocks;
  assert.equal(content.length,1);
  assert.equal(content[0].type,"paragraph");
  assert.equal(content[0].children.filter((item)=>item.type==="math").length,1);
  assert.equal(doc.conversation.stats.images,0);
  assert.equal(doc.conversation.stats.mathNodes,1);
});
