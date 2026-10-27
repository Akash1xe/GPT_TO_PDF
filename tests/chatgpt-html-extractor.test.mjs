import test from "node:test";
import assert from "node:assert/strict";
import { extractChatGPTConversationFromHtml } from "../src/lib/extractors/chatgpt-html-extractor.ts";
import { parseConversationData } from "../src/lib/conversation/validation.ts";

const extract = (html, options = {}) => extractChatGPTConversationFromHtml(html, {
  capturedAt: "2026-10-26T12:00:00.000Z", ...options,
});

test("preserves ordered user/assistant roles in legacy and modern semantic renderers", () => {
  const html = `<!DOCTYPE html><html><head><title>Algorithms - ChatGPT</title></head><body>
    <main>
      <article data-message-author-role="user" data-message-id="m1"><p>What is binary search?</p></article>
      <article data-conversation-role="assistant" data-message-id="m2"><h2>Answer</h2><p>Split in half.</p></article>
      <section data-turn="user" data-turn-id="m3"><p>Thanks</p></section>
    </main></body></html>`;
  const r = extract(html,{sourceUrl:"https://chatgpt.com/c/example"});
  assert.ok(r.conversation);
  assert.equal(r.conversation.title,"Algorithms");
  assert.deepEqual(r.conversation.messages.map(m=>m.role),["user","assistant","user"]);
  assert.deepEqual(r.conversation.messages.map(m=>m.order),[0,1,2]);
  assert.deepEqual(r.conversation.messages.map(m=>m.id),["m1","m2","user:m3"]);
  assert.equal(r.conversation.stats.totalMessages,3);
  assert.equal(r.conversation.completeness.state,"possibly-partial");
  assert.equal(r.conversation.possiblyPartial,true);
  assert.equal(r.conversation.conversationId,"example");
  assert.equal(parseConversationData(r.conversation).ok,true);
});

test("grouped ChatGPT renderer separates the user bubble from assistant sibling content", () => {
  const html = `<div data-turn-key="g1">
    <div data-user-message-bubble><div class="whitespace-pre-wrap">My private prompt</div></div>
    <div data-message-id="a1"><h5 data-conversation-role="assistant">ChatGPT said:</h5></div>
    <div class="markdown"><p>First response</p></div>
    <section><div class="rounded">Chart: 128</div></section>
    <div class="markdown"><p>Final response</p></div>
    <button aria-label="Copy">Copy</button>
  </div>`;
  const r = extract(html);
  assert.ok(r.conversation);
  assert.equal(r.conversation.messages.length,2);
  const [user,assistant] = r.conversation.messages;
  assert.equal(user.role,"user");
  assert.match(user.plainText,/My private prompt/);
  assert.equal(assistant.role,"assistant");
  assert.match(assistant.plainText,/First response/);
  assert.match(assistant.plainText,/Chart: 128/);
  assert.match(assistant.plainText,/Final response/);
  assert.doesNotMatch(assistant.plainText,/private prompt|Copy|ChatGPT said/i);
  assert.equal(user.id,"group:user:g1");
  assert.equal(assistant.id,"a1");
});

test("nested user bubble under outer role is collected once", () => {
  const html = '<article data-message-author-role="user" data-turn-id="turn-1"><div class="metadata">You said</div><div data-user-message-bubble><p>Hello</p></div></article>';
  const r=extract(html);
  assert.equal(r.conversation?.messages.length,1);
  assert.equal(r.conversation.messages[0].plainText,"Hello");
});

test("repeated identical text is not deduplicated without stable message IDs", () => {
  const r=extract('<article data-role="user">Hi</article><article data-role="user">Hi</article><article data-role="assistant">Hello</article>');
  assert.equal(r.conversation?.messages.length,3);
  assert.notEqual(r.conversation.messages[0].id,r.conversation.messages[1].id);
  assert.equal(r.conversation.messages[1].plainText,"Hi");
});

test("same stable message ID is not exported twice", () => {
  const r=extract('<article data-message-author-role="user" data-message-id="u1">Hi</article><article data-message-author-role="user" data-message-id="u1">Hi</article>');
  assert.equal(r.conversation?.messages.length,1);
  assert.equal(r.diagnostics.skippedDuplicateIds,1);
});

test("preserves headings, bold, italics, strikethrough and safe links", () => {
  const r=extract(`<article data-message-author-role="assistant">
    <h2>Algorithm <em>guide</em></h2>
    <p>Learn <strong>fast</strong> and <del>slow</del> from
       <a href="https://example.org/docs?q=one&amp;n=2">documentation</a>.</p>
  </article>`);
  const blocks=r.conversation.messages[0].blocks;
  assert.equal(blocks[0].type,"heading");
  assert.equal(blocks[0].level,2);
  assert.equal(blocks[0].children[1].italic,true);
  assert.equal(blocks[1].type,"paragraph");
  assert.ok(blocks[1].children.some(n=>n.type==="text" && n.bold));
  assert.ok(blocks[1].children.some(n=>n.type==="text" && n.strikethrough));
  const link=blocks[1].children.find(n=>n.type==="link");
  assert.equal(link.href,"https://example.org/docs?q=one&n=2");
});

test("unsafe hrefs are converted to readable text without clickable URLs", () => {
  const r=extract('<article data-role="assistant"><p><a href="javascript:alert(1)">Bad link</a> and <a href="mailto:test@example.org">mail</a></p></article>');
  const nodes=r.conversation.messages[0].blocks[0].children;
  assert.equal(nodes.filter(n=>n.type==="link").length,1);
  assert.match(r.conversation.messages[0].plainText,/Bad link/);
  assert.ok(r.warnings.some(w=>w.includes("Unsafe")));
});

test("recovers ordered and unordered nested lists, block quotes, rules and lines", () => {
  const r=extract(`<article data-role="assistant">
    <ol start="3"><li><p>Third</p><ul><li>nested</li></ul></li><li>Fourth</li></ol>
    <blockquote><p>Important <b>quote</b></p></blockquote><hr/>
    <p>Line one<br/>Line two</p>
  </article>`);
  const blocks=r.conversation.messages[0].blocks;
  assert.equal(blocks[0].type,"ordered-list");
  assert.equal(blocks[0].start,3);
  assert.equal(blocks[0].items.length,2);
  assert.equal(blocks[0].items[0].blocks[1].type,"unordered-list");
  assert.equal(blocks[1].type,"blockquote");
  assert.equal(blocks[2].type,"horizontal-rule");
  assert.equal(blocks[3].type,"paragraph");
  assert.ok(blocks[3].children.some(x=>x.type==="line-break"));
});

test("table headers, rows, colspans and rowspans retain semantic structure", () => {
  const r=extract(`<article data-role="assistant"><table><thead><tr><th colspan="2">Head</th></tr></thead>
    <tbody><tr><td rowspan="2"><strong>A</strong></td><td><a href="/docs">one</a></td></tr>
    <tr><td>two</td></tr></tbody></table></article>`);
  const table=r.conversation.messages[0].blocks[0];
  assert.equal(table.type,"table");
  assert.equal(table.rows.length,3);
  assert.equal(table.rows[0].cells[0].header,true);
  assert.equal(table.rows[0].cells[0].colspan,2);
  assert.equal(table.rows[1].cells[0].rowspan,2);
  assert.equal(table.columnCount,2);
  assert.equal(table.rows[1].cells[0].children[0].bold,true);
  assert.equal(table.rows[1].cells[1].children[0].href,"https://chatgpt.com/docs");
});

test("plain code blocks and inline code retain punctuation and indentation", () => {
  const r=extract(`<article data-role="assistant"><p>Use <code>binary_search</code>:</p>
    <pre><code class="language-cpp">int main() {&#10;  return 0;&#10;}</code></pre></article>`);
  const blocks=r.conversation.messages[0].blocks;
  assert.equal(blocks[0].children[1].type,"inline-code");
  assert.equal(blocks[1].type,"code");
  assert.equal(blocks[1].language,"cpp");
  assert.equal(blocks[1].code,"int main() {\n  return 0;\n}");
  assert.equal(blocks[1].lineCount,3);
  assert.equal(blocks[1].lines[1].plainText,"  return 0;");
});

test("source math attribute can be represented pending specialized math parsing", () => {
  const r=extract('<article data-role="assistant"><p>Compute <span data-math-source="x_i^2"></span>.</p><div data-math-source="\\\\frac{a}{b}"></div></article>');
  const blocks=r.conversation.messages[0].blocks;
  assert.equal(blocks[0].children.find(n=>n.type==="math").fallbackText,"x_i^2");
  assert.equal(blocks[1].type,"math");
  assert.equal(r.conversation.stats.mathNodes,2);
});

test("does not evaluate scripts, serialize controls or accidentally read navigation", () => {
  const r=extract(`<html><head><title>Scratch - ChatGPT</title></head>
    <body><nav>Secret menu</nav><article data-role="assistant">
    <script>globalThis.malicious=1</script><style>body{background:red}</style>
    <p>Safe answer</p><button aria-label="Copy">Copy</button>
    <div hidden>Hidden content</div><div aria-hidden="true">Invisible</div>
    </article></body></html>`);
  assert.equal(r.conversation.messages[0].plainText,"Safe answer");
  assert.equal(globalThis.malicious,undefined);
});

test("hydration-only and login snapshots return null, not a fake empty conversation", () => {
  const hydration=extract('<html><head><title>ChatGPT</title></head><body><script>self.__next_f.push([1,"data"])</script></body></html>');
  assert.equal(hydration.conversation,null);
  assert.equal(hydration.diagnostics.pageHasHydrationStream,true);
  assert.match(hydration.warnings.join(" "),/hydration data/);
  const login=extract("<title>Log in to ChatGPT</title>");
  assert.equal(login.conversation,null);
  assert.match(login.warnings.join(" "),/access-check/);
});

test("preserves image and SVG blocks in the original document order", () => {
  const r=extract('<article data-role="assistant"><p>Before<img width="240" height="160" alt="Example" src="https://example.com/photo.png"> after</p><svg viewBox="0 0 400 100"><text>Chart</text></svg></article>');
  assert.equal(r.diagnostics.pageHasImageOrDiagramNodes,true);
  assert.equal(r.conversation.stats.images,2);
  assert.deepEqual(r.conversation.messages[0].blocks.map(b=>b.type),["paragraph","image","paragraph","image"]);
  assert.equal(r.conversation.messages[0].blocks[1].width,240);
  assert.equal(r.conversation.messages[0].blocks[3].mediaKind,"svg");
  assert.ok(r.warnings.some(w=>/CSS-only|computed styles/.test(w)));
});

test("rejects oversized HTML, but never fetches sources", () => {
  assert.throws(()=>extract("X".repeat(2_000_001)),/2 MB/);
  const result=extract('<article data-role="user">Hello</article>');
  assert.equal(result.conversation.messages[0].plainText,"Hello");
  assert.equal(result.conversation.capturedUrl,"https://chatgpt.com/");
  assert.match(result.warnings.join(" "),/No source URL supplied/);
});
