import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { parseHTML } from "linkedom";
import { CHATGPT_CAPTURE_BOOKMARKLET } from "../src/lib/extractors/shared-page-bookmarklet.ts";
import { extractChatGPTConversationFromHtml } from "../src/lib/extractors/chatgpt-html-extractor.ts";

const share = "https://chatgpt.com/share/6adfb5d3-f814-83ee-9e27-ae27a037d94f";

async function executeBookmarklet(markup, locationHref = share) {
  const { document } = parseHTML(markup);
  let copied = null;
  const alerts = [];
  const location = new URL(locationHref);
  const context = {
    document, location,
    navigator: { clipboard: { writeText: async value => { copied = value; } } },
    alert: message => alerts.push(message),
  };
  const value = vm.runInNewContext(CHATGPT_CAPTURE_BOOKMARKLET.slice("javascript:".length), context, { timeout: 1000 });
  await value;
  return { copied, alerts };
}

test("capture bookmarklet is explicit user-side code, without remote fetches", () => {
  assert.match(CHATGPT_CAPTURE_BOOKMARKLET, /^javascript:/);
  assert.doesNotMatch(CHATGPT_CAPTURE_BOOKMARKLET, /\bfetch\s*\(/);
  assert.doesNotMatch(CHATGPT_CAPTURE_BOOKMARKLET, /XMLHttpRequest|sendBeacon|localStorage|document\.cookie/);
});

test("captures role-marked HTML, source URL and rich code in document order", async () => {
  const markup = `<html><head><title>Loops &amp; Tables - ChatGPT</title></head><body>
  <header>Unrelated navigation</header><main>
    <article data-message-author-role="user" data-message-id="u1"><p>Show C++</p></article>
    <article data-message-author-role="assistant" data-message-id="a1">
      <h2>Answer</h2><pre><code>int x = 2;</code></pre>
      <table><tr><th>Value</th></tr><tr><td>2</td></tr></table>
      <button>Do not include buttons</button>
    </article>
  </main><script>window.secret=123;</script></body></html>`;
  const result = await executeBookmarklet(markup);
  assert.equal(result.alerts.length, 1);
  assert.match(result.alerts[0], /Copied 2 message markers/);
  assert.match(result.copied, /chatpdf-capture-source/);
  assert.match(result.copied, /int x = 2/);
  assert.doesNotMatch(result.copied, /Do not include buttons|window.secret|Unrelated navigation/);
  const extracted = extractChatGPTConversationFromHtml(result.copied, { sourceUrl: share });
  assert.equal(extracted.conversation?.messageCount, 2);
  assert.deepEqual(extracted.conversation?.messages.map(m => m.role), ["user", "assistant"]);
  assert.equal(extracted.conversation?.url, share);
  assert.ok(extracted.conversation?.stats.codeBlocks >= 1);
});

test("rejects unrelated and private pages and HTML without messages", async () => {
  const html = "<html><body><main><p>No messages</p></main></body></html>";
  for (const href of ["https://example.com/share/6adfb5d3-f814-83ee-9e27-ae27a037d94f", "https://chatgpt.com/c/6adfb5d3-f814-83ee-9e27-ae27a037d94f", share]) {
    const result = await executeBookmarklet(html, href);
    assert.equal(result.copied, null);
    assert.match(result.alerts.join(" "), /ChatGPT capture:/);
  }
});
