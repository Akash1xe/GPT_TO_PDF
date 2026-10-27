import test from "node:test";
import assert from "node:assert/strict";
import { learningExport, learningGraph } from "./fixtures/learning-ui.mjs";
import { importExportedConversation } from "../src/lib/import/export-conversation.ts";
import { parseRichMarkdown } from "../src/lib/import/markdown.ts";
import { parseChatGPTRichMessage } from "../src/lib/import/chatgpt-rich-message.ts";
import { countExternalImages } from "../src/lib/pdf/external-media.ts";
import { parseConversationData } from "../src/lib/conversation/validation.ts";

const flatten=blocks=>blocks.flatMap(b=>[b,...(b.blocks?flatten(b.blocks):b.items?b.items.flatMap(i=>flatten(i.blocks)):[])]);

test("conditional quizzes and mapped progress sections retain all lesson content",()=>{
 const result=importExportedConversation(learningExport());
 const conversation=result.conversation;
 assert.deepEqual(conversation.stats,{totalMessages:4,userMessages:2,assistantMessages:2,codeBlocks:1,mathNodes:5,images:5});
 const blocks=conversation.messages.flatMap(m=>flatten(m.blocks));
 assert.equal(blocks.filter(b=>b.type==="control"&&b.kind==="checkbox").length,5);
 assert.equal(blocks.filter(b=>b.type==="control"&&b.kind==="radio").length,11);
 assert.equal(blocks.filter(b=>b.type==="control"&&b.kind==="radio"&&b.checked).length,1);
 assert.equal(blocks.find(b=>b.type==="control"&&b.kind==="progress").percent,0);
 assert.equal(blocks.find(b=>b.type==="code").code,learningGraph);
 assert.ok(blocks.some(b=>b.type==="layout"&&b.columns===2));
 assert.equal(countExternalImages(conversation),5);
 assert.equal(parseConversationData(conversation).ok,true);
 assert.doesNotMatch(JSON.stringify(conversation),/FALLBACK_SHOULD_NOT_REPLACE/);
 assert.equal(blocks.find(b=>b.type==="image").captionHref,"https://sources.example/one");
 assert.ok(conversation.messages[1].plainText.includes("Correct! A database stores data."));
});

test("Markdown math survives escapes and is not interpreted inside code fences or inline code",()=>{
 const source=String.raw`Inline \(T_{network}\) and $x^2$.

\[
T_{total}=50+30+20=\boxed{100\text{ ms}}
\]

$$\frac{a}{b}$$

Literal: BACKTICK\(not math\)BACKTICK. Prices are $5 and $10.

BACKTICKBACKTICKBACKTICKtex
\[keep this as code\]
BACKTICKBACKTICKBACKTICK`.replaceAll("BACKTICK",String.fromCharCode(96));
 const result=parseRichMarkdown(source),blocks=flatten(result.blocks);
 const nodes=blocks.flatMap(b=>b.type==="math"?[b]:b.type==="paragraph"?b.children.filter(n=>n.type==="math"):[]);
 assert.equal(nodes.length,4);
 assert.ok(nodes.some(n=>n.source.includes("\\boxed{100\\text{ ms}}")));
 assert.equal(blocks.filter(b=>b.type==="code").length,1);
 assert.match(result.plainText,/Prices are \$5 and \$10/);
});

test("data-expression reconstruction never calls arbitrary functions, getters or event handlers",()=>{
 globalThis.__learningSideEffect=0;
 const unsafe=`DIL.render(__dil.jsx(()=>{const rows=[1];return rows.map(x=>fetch("https://example.test/"));}));`;
 const result=parseChatGPTRichMessage("Original lesson",{model_dil_v2:{code:unsafe,constants:{},fallbackMarkdown:"Safe lesson alternative"}});
 assert.equal(result.plainText,"Safe lesson alternative");
 const getter=`DIL.render(__dil.jsx(()=>{const rows=[{get secret(){globalThis.__learningSideEffect=1;return "bad";}}];return rows.map(x=>__dil.jsx("text",null,x.secret));}));`;
 assert.equal(parseChatGPTRichMessage("Original",{model_dil_v2:{code:getter,constants:{},fallbackMarkdown:"Safe alternative"}}).plainText,"Safe alternative");
 assert.equal(globalThis.__learningSideEffect,0);
 delete globalThis.__learningSideEffect;
});
