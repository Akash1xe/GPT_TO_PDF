import assert from "node:assert/strict";
import test from "node:test";
import { extractSharedConversation, retrieveSharedConversation } from "../src/lib/extractors/shared-link-import.ts";
import { POST } from "../src/app/api/shared-link/inspect/route.ts";

const url = "https://chatgpt.com/share/6ae00e67-ccd0-83ee-9e89-4dc44c105407";
const message = (id, role, text, extra = {}) => ({ id, author: {role}, recipient: "all", content: {content_type:"text", parts:[text]}, ...extra });
const exported = {
  title: "Shared test", current_node: "final",
  mapping: {
    user: { parent:null, message:message("u", "user", "Explain code") },
    hidden: { parent:"user", message:message("h", "assistant", "hidden", {metadata:{is_visually_hidden_from_conversation:true}}) },
    tool: { parent:"hidden", message:message("t", "assistant", "tool call", {recipient:"functions.exec"}) },
    reasoning: {parent:"tool", message:message("r", "assistant", "reasoning", {content:{content_type:"thoughts", parts:["internal"]}})},
    final: {parent:"reasoning", message:message("a", "assistant", "## Example\n\n```js\nconst x = 1;\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |")},
    alternate: {parent:"user", message:message("alternate", "assistant", "Wrong branch")},
  },
};
function streamHtml(data) {
  const values = [];
  function encode(value) {
    if (value === null) return -5;
    const index = values.length;
    values.push(null);
    values[index] = Array.isArray(value) ? value.map(encode) : typeof value === "object"
      ? Object.fromEntries(Object.entries(value).map(([k,v]) => ["_"+encode(k),encode(v)])) : value;
    return index;
  }
  encode({loaderData:{share:{serverResponse:{data}}}});
  return `<script>window.__reactRouterContext.streamController.enqueue(${JSON.stringify(JSON.stringify(values))});</script>`;
}
const html = streamHtml(exported);
test("modern streamed shares preserve active branch and rich content, excluding hidden and tool messages", () => {
  const {conversation} = extractSharedConversation(html, url);
  assert.equal(conversation.title, "Shared test");
  assert.deepEqual(conversation.messages.map(m=>m.role), ["user","assistant"]);
  assert.equal(conversation.stats.codeBlocks, 1);
  assert.equal(conversation.url,url);
  assert.equal(conversation.capturedUrl,url);
  assert.doesNotMatch(JSON.stringify(conversation), /Wrong branch|tool call|internal|"hidden"/);
});
test("legacy JSON and static HTML remain supported without evaluating scripts", () => {
  assert.equal(extractSharedConversation(`<script id="__NEXT_DATA__">${JSON.stringify({props:{pageProps:exported}})}</script>`,url).conversation.messageCount,2);
  assert.equal(extractSharedConversation('<article data-role="user">Hello</article><script>throw Error("never run")</script>',url).conversation.messageCount,1);
  assert.throws(()=>extractSharedConversation('<html>Sign in</html>',url),{code:"NO_CONVERSATION"});
});
test("retrieval canonicalizes URLs, omits credentials, disables redirects and caching", async () => {
  const result = await retrieveSharedConversation(url+"?tracking=secret", async (target,options) => {
    assert.equal(target,url);
    assert.equal(options.redirect,"manual");
    assert.equal(options.credentials,"omit");
    assert.equal(options.cache,"no-store");
    assert.ok(options.signal);
    return new Response(html,{headers:{"Content-Type":"text/html"}});
  });
  assert.equal(result.conversation.messageCount,2);
  await assert.rejects(retrieveSharedConversation("http://127.0.0.1",()=>assert.fail("must not fetch")),{code:"UNSAFE_URL"});
});
test("blocked, redirected, oversized, non-HTML and failed upstream responses produce controlled errors", async () => {
  for (const status of [302,403,404,429,500]) {
    await assert.rejects(retrieveSharedConversation(url,async()=>new Response("blocked",{status})),{code:"SHARE_UNAVAILABLE"});
  }
  await assert.rejects(retrieveSharedConversation(url,async()=>new Response("{}",{headers:{"Content-Type":"application/json"}})),{code:"UNEXPECTED_RESPONSE"});
  await assert.rejects(retrieveSharedConversation(url,async()=>new Response("x".repeat(2_000_001),{headers:{"Content-Type":"text/html"}})),{code:"SHARE_TOO_LARGE"});
  await assert.rejects(retrieveSharedConversation(url,async()=>{throw new Error("network")}),{code:"IMPORT_FAILED"});
});
test("API retrieval returns a conversation the client can send to PDF controls", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async()=>new Response(html,{headers:{"Content-Type":"text/html"}});
    const response=await POST(new Request("https://example.test/api/shared-link/inspect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,retrieve:true})}));
    const result=await response.json();
    assert.equal(response.status,200);
    assert.equal(result.conversionReady,true);
    assert.equal(result.conversation.messageCount,2);
    assert.equal(response.headers.get("cache-control"),"no-store");
    globalThis.fetch = async()=>new Response("blocked",{status:403});
    const blocked=await POST(new Request("https://example.test/api/shared-link/inspect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,retrieve:true})}));
    assert.equal(blocked.status,422);
    assert.equal((await blocked.json()).conversionReady,false);
  } finally {globalThis.fetch=original;}
});
