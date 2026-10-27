import test from "node:test";
import assert from "node:assert/strict";
import { extractChatGPTConversationFromHtml } from "../src/lib/extractors/chatgpt-html-extractor.ts";
import { parseHtmlTree, descendants, tag } from "../src/lib/extractors/html-tree.ts";
import { normalizeLanguage } from "../src/lib/extractors/chatgpt-code.ts";
import { extractMathNode } from "../src/lib/extractors/chatgpt-math.ts";
import { prepareMathPreview } from "../src/lib/extractors/math-preview.ts";
import { parseConversationData } from "../src/lib/conversation/validation.ts";

function extract(html) {
  return extractChatGPTConversationFromHtml(
    '<article data-message-author-role="assistant">' + html + '</article>',
    { capturedAt: "2026-10-26T12:00:00.000Z" },
  ).conversation;
}
function firstBlock(html) {
  return extract(html)?.messages[0]?.blocks[0];
}
function firstNode(html, name) {
  return descendants(parseHtmlTree(html), (node) => tag(node) === name)[0];
}

test("keeps highlight.js spans as typed semantic code tokens", () => {
  const block = firstBlock('<pre><code class="language-js"><span class="hljs-keyword">const</span> x = <span class="hljs-number">42</span>;</code></pre>');
  assert.equal(block.type, "code");
  assert.equal(block.language, "javascript");
  assert.equal(block.displayLanguage, "JavaScript");
  assert.equal(block.source, "dom-highlighted");
  assert.equal(block.code, "const x = 42;");
  assert.equal(block.lines[0].tokens[0].tokenType, "keyword");
  assert.ok(block.lines[0].tokens.some((x) => x.tokenType === "number" && x.text === "42"));
  assert.equal(block.lines[0].tokens.map((x) => x.text).join(""), block.code);
});

test("keeps Prism syntax tokens and separate lines, preserving source exactly", () => {
  const block = firstBlock('<pre data-language="typescript"><code><span class="token keyword">let</span> x = <span class="token string">&quot;ok&quot;</span>;&#10;  <span class="token comment">// explanation</span></code></pre>');
  assert.equal(block.type, "code");
  assert.equal(block.language, "typescript");
  assert.equal(block.source, "dom-highlighted");
  assert.equal(block.code, 'let x = "ok";\n  // explanation');
  assert.equal(block.lines.length, 2);
  assert.equal(block.lines[1].plainText, "  // explanation");
  assert.ok(block.lines[1].tokens.some((x) => x.tokenType === "comment"));
});

test("the extension's fallback highlighter supports plain C++ code", () => {
  const block = firstBlock('<pre><code class="language-cpp">int main() {&#10;    return 42;&#10;}</code></pre>');
  assert.equal(block.code, "int main() {\n    return 42;\n}");
  assert.equal(block.source, "plain");
  assert.ok(block.lines.flatMap((line) => line.tokens).some((t) => t.tokenType === "keyword" && t.text.includes("return")));
  assert.equal(block.lines[1].plainText, "    return 42;");
});

test("unmarked code retains literal trailing newline and blank lines", () => {
  const block = firstBlock('<pre><code>a = 1&#10;&#10;  b = 2&#10;</code></pre>');
  assert.equal(block.code, "a = 1\n\n  b = 2\n");
  assert.equal(block.lineCount, 4);
  assert.equal(block.lines[1].plainText, "");
  assert.equal(block.lines[3].plainText, "");
});

test("structural code line wrappers do not create a fake last blank line", () => {
  const block = firstBlock('<pre><code><div class="line">line 1</div><div class="line">  line 2</div></code></pre>');
  assert.equal(block.code, "line 1\n  line 2");
  assert.equal(block.lineCount, 2);
});

test("language aliases and display names match the extension conventions", () => {
  assert.equal(normalizeLanguage("language-C++"), "cpp");
  assert.equal(normalizeLanguage("lang-Py"), "python");
  assert.equal(normalizeLanguage("javascript"), "javascript");
  assert.equal(normalizeLanguage("javascript;background:red"), undefined);
  assert.equal(firstBlock('<pre><code data-language="C++">return 2;</code></pre>').displayLanguage, "C++");
});

test("a marked multiline code element becomes a full block while inline code stays inline", () => {
  const conv = extract('<code class="language-sql">SELECT 1;</code><p>Then <code>SELECT</code> here.</p>');
  assert.equal(conv.messages[0].blocks[0].type, "code");
  assert.equal(conv.messages[0].blocks[0].language, "sql");
  assert.equal(conv.messages[0].blocks[1].type, "paragraph");
  assert.ok(conv.messages[0].blocks[1].children.some((n) => n.type === "inline-code"));
});

test("KaTeX inline math recovers TeX annotations and avoids MathML duplication", () => {
  const block = firstBlock('<p>Calculate <span class="katex"><span class="katex-mathml"><math><semantics><mrow><mfrac><mi>a</mi><mi>b</mi></mfrac></mrow><annotation encoding="application/x-tex">\\frac{a}{b}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">a/b</span></span>.</p>');
  assert.equal(block.type, "paragraph");
  const math = block.children.filter((node) => node.type === "math");
  assert.equal(math.length, 1);
  assert.equal(math[0].source, "\\frac{a}{b}");
  assert.equal(math[0].renderStrategy, "latex");
  assert.equal(math[0].displayMode, "inline");
  assert.match(math[0].mathML, /<mfrac>/);
  assert.match(math[0].mathML, /xmlns="http:\/\/www.w3.org\/1998\/Math\/MathML"/);
});

test("display KaTeX becomes one block math node, not two separate equations", () => {
  const conv = extract('<span class="katex-display"><span class="katex"><span class="katex-mathml"><math display="block"><semantics><mi>x</mi><annotation encoding="application/x-tex">\\int_0^1 x\\,dx</annotation></semantics></math></span></span></span>');
  const blocks = conv.messages[0].blocks;
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "math");
  assert.equal(blocks[0].displayMode, "block");
  assert.equal(blocks[0].source, "\\int_0^1 x\\,dx");
  assert.equal(conv.stats.mathNodes, 1);
});

test("complex MathML matrices are retained without a TeX annotation", () => {
  const math = firstBlock('<math display="block"><mrow><mo>∫</mo><msub><mi>x</mi><mn>0</mn></msub><mtable><mtr><mtd><mn>1</mn></mtd><mtd><mn>2</mn></mtd></mtr><mtr><mtd><mn>3</mn></mtd><mtd><mn>4</mn></mtd></mtr></mtable></mrow></math>');
  assert.equal(math.type, "math");
  assert.equal(math.sourceFormat, "mathml");
  assert.equal(math.renderStrategy, "mathml");
  assert.equal(math.displayMode, "block");
  assert.match(math.mathML, /<mtable>/);
  assert.match(math.mathML, /<mtr>/);
  assert.match(math.fallbackText, /∫/);
});

test("MathML serializer strips scripts, events, URLs and CSS injection", () => {
  const node = firstNode('<math onclick="steal()" style="background:red"><mfrac href="javascript:attack()" onmouseover="steal()" mathcolor="red"><mn>1</mn><mi>x</mi></mfrac><script>attack()</script><annotation encoding="text/html"><img src=x></annotation></math>', "math");
  const math = extractMathNode(node);
  assert.ok(math);
  assert.match(math.mathML, /mathcolor="red"/);
  assert.doesNotMatch(math.mathML, /onclick|style=|href=|onmouseover|script|annotation|<img|attack/);
  assert.match(math.mathML, /<mfrac(?:\s|>)/);
});

test("source may come from TeX attributes or accessible formulas", () => {
  const explicit = firstBlock('<p><span data-latex="\\sum_{i=1}^{n} i"></span></p>');
  const aria = firstBlock('<p><span class="katex" aria-label="x_i^2"></span></p>');
  assert.equal(explicit.children[0].source, "\\sum_{i=1}^{n} i");
  assert.equal(aria.children[0].source, "x_i^2");
  assert.equal(aria.children[0].renderStrategy, "latex");
});

test("TeX rendering supports complex fractions, matrices and integrals", () => {
  for (const latex of [
    "\\frac{1}{\\sqrt{2\\pi}}",
    "\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}",
    "\\int_0^\\infty e^{-x^2}\\,dx",
  ]) {
    const preview = prepareMathPreview({
      type: "math", displayMode: "block", source: latex, sourceFormat: "latex",
      fallbackText: latex, renderStrategy: "latex",
    });
    assert.equal(preview.kind, "katex", latex);
    assert.match(preview.html, /class="katex/);
    assert.match(preview.html, /<math/);
  }
});

test("malformed TeX falls back to whitelisted MathML when present", () => {
  const preview = prepareMathPreview({
    type: "math", displayMode: "inline", source: "\\notarealcommand", sourceFormat: "latex",
    fallbackText: "fallback",
    mathML: '<math onload="alert(1)"><mfrac><mn>1</mn><mi>x</mi></mfrac><script>bad()</script></math>',
    renderStrategy: "latex",
  });
  assert.equal(preview.kind, "mathml");
  assert.match(preview.html, /<mfrac>/);
  assert.doesNotMatch(preview.html, /onload|script|alert/);
});

test("invalid or inaccessible math falls back to readable plain text", () => {
  const result = prepareMathPreview({
    type: "math", displayMode: "inline", source: "\\unknowncmd",
    sourceFormat: "latex", fallbackText: "one over x", renderStrategy: "text-fallback",
  });
  assert.deepEqual(result, { kind: "text", text: "one over x" });
});

test("math in tables and links increments normalized conversation stats", () => {
  const result = extractChatGPTConversationFromHtml(
    '<article data-role="assistant"><p><a href="https://example.com"><span data-tex="x^2"></span></a></p><table><tr><td><math><mfrac><mn>1</mn><mn>2</mn></mfrac></math></td></tr></table></article>'
  );
  assert.equal(result.conversation.stats.mathNodes, 2);
  assert.equal(parseConversationData(result.conversation).ok, true);
});

test("math parsing never executes untrusted page scripts or remote assets", () => {
  const r = extractChatGPTConversationFromHtml('<article data-role="assistant"><span data-formula="x^2"></span><script>globalThis.injected=1</script></article>');
  assert.equal(r.conversation.stats.mathNodes, 1);
  assert.equal(globalThis.injected, undefined);
});
