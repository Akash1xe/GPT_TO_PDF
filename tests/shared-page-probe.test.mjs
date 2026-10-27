import assert from "node:assert/strict";
import test from "node:test";
import { inspectUserProvidedSharedHtml } from "../src/lib/extractors/shared-page-probe.ts";

test("extracts simple roles and text from static user-provided HTML", () => {
  const html = `<!doctype html><html><head><title>Example share</title></head><body>
    <article data-message-author-role="user"><p>Explain <b>binary search</b></p></article>
    <article data-message-author-role="assistant"><h2>Answer</h2><p>Check the middle.</p><pre><code>int x=1;</code></pre>
       <script>attack()</script><nav>Copy</nav></article>
  </body></html>`;
  const result = inspectUserProvidedSharedHtml(html);
  assert.equal(result.kind, "static-markup");
  assert.equal(result.title, "Example share");
  assert.equal(result.messages.length, 2);
  assert.deepEqual(result.messages.map(m => m.role), ["user", "assistant"]);
  assert.match(result.messages[1].text, /Check the middle/);
  assert.match(result.messages[1].text, /int x=1/);
  assert.doesNotMatch(result.messages[1].text, /attack|Copy/);
});

test("handles user bubble markers and nested roles without duplication", () => {
  const html = '<div data-message-author-role="user"><span data-user-message-bubble>Hello</span></div><section data-conversation-role="assistant"><p>World</p></section>';
  const r = inspectUserProvidedSharedHtml(html);
  assert.deepEqual(r.messages.map(m => m.text), ["Hello", "World"]);
  assert.equal(r.signals.roleMarkers, 3);
});

test("detects hydration-only pages without claiming missing messages", () => {
  const html = '<html><head><title>Shared conversation</title></head><body><script>self.__next_f.push([1,"payload"])</script></body></html>';
  const r = inspectUserProvidedSharedHtml(html);
  assert.equal(r.kind, "hydration-only");
  assert.equal(r.messages.length, 0);
  assert.ok(r.warnings.some(w => /page shell/.test(w)));
});

test("classifies login and unknown content safely", () => {
  assert.equal(inspectUserProvidedSharedHtml('<title>Log in to ChatGPT</title>').kind, "blocked-or-login");
  assert.equal(inspectUserProvidedSharedHtml('<p>Just a page</p>').kind, "unrecognized");
});

test("rejects enormous HTML samples", () => {
  assert.throws(() => inspectUserProvidedSharedHtml("x".repeat(2_000_001)), /2 MB/);
});
