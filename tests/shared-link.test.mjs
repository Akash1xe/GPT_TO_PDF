import assert from "node:assert/strict";
import test from "node:test";
import { validateChatGPTShareLink } from "../src/lib/security/shared-link.ts";
import { GET, POST } from "../src/app/api/shared-link/inspect/route.ts";

const ID = "696ac45b-70d8-8003-9ca4-320151e0816e";
const url = `https://chatgpt.com/share/${ID}`;

test("only canonical ChatGPT conversation shares are accepted", () => {
  const normal = validateChatGPTShareLink(url);
  assert.equal(normal.ok, true);
  assert.equal(normal.canonicalUrl, url);
  assert.equal(normal.access, "not-verified");
  assert.deepEqual(validateChatGPTShareLink(url + "/?utm_source=test#foo"), normal);
});

test("rejects private, hostile and malformed URLs", () => {
  const cases = [
    ["https://chatgpt.com/c/abc", "PRIVATE_CONVERSATION"],
    ["https://chatgpt.com/share/abc", "INVALID_SHARE_ID"],
    ["https://chatgpt.com/share/" + ID + "/extra", "INVALID_SHARE_ID"],
    ["https://chatgpt.com/s/" + ID, "UNSUPPORTED_PATH"],
    ["https://chatgpt.com.evil.example/share/" + ID, "UNSUPPORTED_HOST"],
    ["https://evil.example/?url=chatgpt.com/share/" + ID, "UNSUPPORTED_HOST"],
    ["https://chat.openai.com/share/" + ID, "UNSUPPORTED_HOST"],
    ["http://chatgpt.com/share/" + ID, "UNSAFE_URL"],
    ["https://user:password@chatgpt.com/share/" + ID, "UNSAFE_URL"],
    ["https://chatgpt.com:8443/share/" + ID, "UNSAFE_URL"],
    ["https://chatgpt.com\\@evil.example/share/" + ID, "INVALID_URL"],
    ["not a url", "INVALID_URL"],
    ["", "MISSING_URL"],
  ];
  for (const [value, code] of cases) {
    const result = validateChatGPTShareLink(value);
    assert.equal(result.ok, false, value);
    assert.equal(result.code, code, value);
  }
});

function req(input, headers = { "Content-Type": "application/json" }) {
  return new Request("https://example.test/api/shared-link/inspect", { method: "POST", headers, body: input });
}

test("route validates but never retrieves content", async () => {
  const response = await POST(req(JSON.stringify({ url })));
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.ok, true);
  assert.equal(json.retrieval, "disabled");
  assert.equal(json.conversionReady, false);
  assert.equal(json.canonicalUrl, url);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("route rejects invalid shapes, bodies, oversized input and content type", async () => {
  assert.equal((await POST(req("not json"))).status, 400);
  assert.equal((await POST(req("[]"))).status, 400);
  assert.equal((await POST(req(JSON.stringify({ url: "https://example.com/" })))).status, 400);
  assert.equal((await POST(req("no", { "Content-Type": "text/plain" }))).status, 415);
  const tooBig = await POST(req(JSON.stringify({ url, padding: "x".repeat(6000) })));
  assert.equal(tooBig.status, 413);
});

test("GET accurately describes opt-in retrieval", async () => {
  const response = GET();
  const json = await response.json();
  assert.equal(json.retrieval, "opt-in");
  assert.match(json.limitations.join(" "), /retrieve:true/);
});
