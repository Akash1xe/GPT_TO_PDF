import assert from "node:assert/strict";
import test from "node:test";
import { File } from "node:buffer";
import { zipSync, strToU8 } from "fflate";
import { catalogChatGPTExports, importExportedConversation } from "../src/lib/import/export-conversation.ts";
import { importPastedContent } from "../src/lib/import/pasted-content.ts";
import { loadChatGPTExportFile } from "../src/lib/import/file-import.ts";
import { parseRichMarkdown } from "../src/lib/import/markdown.ts";
import { parseConversationData } from "../src/lib/conversation/validation.ts";

function node(id,parent,role,parts,extras={}) {
 return {id,parent,message:{
  id,author:{role},content:{content_type:"text",parts},...extras
 }};
}
function sample() {
 return {
  id:"sample-id",title:"Branch test",create_time:1761500000,current_node:"a2",
  mapping:{
   root:node("root",null,"system",["Hidden system instructions"]),
   u1:node("u1","root","user",["Please explain **bold** and [reference](https://example.org)"]),
   a1:node("a1","u1","assistant",["Old answer must not appear"]),
   a2:node("a2","u1","assistant",["## Final answer\n\n- one\n- two\n\n\`\`\`js\nconst x = 42;\n\`\`\`\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n$ x^2 $"]),
  }
 };
}
test("catalog lists real conversations and ignores unrelated account metadata",()=>{
 const c=catalogChatGPTExports([{user:"private@example.com"},sample(),{...sample(),id:"second",title:"Second"}]);
 assert.equal(c.choices.length,2);
 assert.equal(c.choices[0].title,"Branch test");
 assert.equal(c.choices[1].conversationId,"second");
 assert.equal(c.warnings.length,1);
});

test("active branch follows parent pointers and excludes sibling/regenerated answers",()=>{
 const r=importExportedConversation(sample());
 assert.equal(r.conversation.messages.length,2);
 assert.deepEqual(r.conversation.messages.map(m=>m.id),["u1","a2"]);
 assert.equal(r.conversation.messages[0].role,"user");
 assert.equal(r.conversation.messages[1].role,"assistant");
 assert.doesNotMatch(JSON.stringify(r.conversation),/Old answer must not appear|Hidden system instructions/);
 assert.equal(r.conversation.conversationId,"sample-id");
 assert.equal(r.conversation.possiblyPartial,true);
 assert.equal(parseConversationData(r.conversation).ok,true);
});

test("rich export content survives as headings, code, tables, lists and safe links",()=>{
 const r=importExportedConversation(sample());
 const u=r.conversation.messages[0].blocks[0];
 const a=r.conversation.messages[1].blocks;
 assert.equal(u.type,"paragraph");
 assert.ok(u.children.some(n=>n.type==="text"&&n.bold));
 assert.ok(u.children.some(n=>n.type==="link"&&n.href==="https://example.org/"));
 assert.equal(a[0].type,"heading");
 assert.equal(a[1].type,"unordered-list");
 assert.equal(a[2].type,"code");
 assert.equal(a[2].code.trim(),"const x = 42;");
 assert.equal(a[3].type,"table");
 assert.equal(r.conversation.stats.codeBlocks,1);
});

test("mixed multimodal parts keep readable text and warn about unavailable image bytes",()=>{
 const s=sample();
 s.current_node="m1";
 s.mapping.m1=node("m1","a2","assistant",["Image is attached",{content_type:"image_asset_pointer",asset_pointer:"file-service://private"}]);
 const r=importExportedConversation(s);
 assert.match(r.conversation.messages[2].plainText,/\[Unavailable image_asset_pointer attachment\]/);
 assert.equal(r.conversation.stats.images,0);
 assert.ok(r.warnings.some(w=>/metadata only/.test(w)));
 assert.doesNotMatch(JSON.stringify(r.conversation),/file-service:\/\//);
});

test("ambiguous branch without current_node is rejected rather than merged",()=>{
 const s=sample();delete s.current_node;
 assert.throws(()=>importExportedConversation(s),/multiple branches/);
});
test("linear mapping with missing current_node is reconstructed with explicit warning",()=>{
 const s=sample();delete s.current_node;delete s.mapping.a1;
 const r=importExportedConversation(s);
 assert.equal(r.conversation.messages.length,2);
 assert.ok(r.warnings.some(w=>/single unambiguous path/.test(w)));
});
test("dangling parent, cycle and overgrown mapping are rejected",()=>{
 const s=sample();s.mapping.a2.parent="missing";
 assert.throws(()=>importExportedConversation(s),/missing active-branch node/);
 s.mapping.a2.parent="a2";
 assert.throws(()=>importExportedConversation(s),/Cycle detected/);
 assert.throws(()=>catalogChatGPTExports([]),/No ChatGPT conversations/);
});

test("plain text paste recognizes author headings and preserves line breaks",()=>{
 const r=importPastedContent("User:\nHi!\nAnd this.\n\nAssistant:\nGood morning.\nNext line.","text");
 assert.deepEqual(r.conversation.messages.map(m=>m.role),["user","assistant"]);
 assert.match(r.conversation.messages[0].plainText,/Hi!\nAnd this/);
 assert.ok(r.conversation.messages[1].blocks[0].children.some(n=>n.type==="line-break"));
 assert.equal(parseConversationData(r.conversation).ok,true);
});
test("unlabeled paste never fabricates assistant messages",()=>{
 const r=importPastedContent("A private note to myself.","text");
 assert.equal(r.conversation.messages.length,1);
 assert.equal(r.conversation.messages[0].role,"user");
 assert.ok(r.warnings.some(w=>/one user message/.test(w)));
});
test("Markdown paste preserves fenced code, rich lists, links, tables and blocks script",()=>{
 const value="Assistant:\n# Heading\n\n**Strong** [docs](https://example.com/x)\n\n\`\`\`cpp\nint main() {return 0;}\n\`\`\`\n\n| key | value |\n|---|---|\n| left | right |\n\n<script>window.hacked=1</script>";
 const r=importPastedContent(value,"markdown");
 assert.deepEqual(r.conversation.messages.map(m=>m.role),["assistant"]);
 const b=r.conversation.messages[0].blocks;
 assert.ok(b.some(x=>x.type==="heading"));
 assert.ok(b.some(x=>x.type==="code"));
 assert.ok(b.some(x=>x.type==="table"));
 assert.equal(globalThis.hacked,undefined);
 assert.equal(parseConversationData(r.conversation).ok,true);
});
test("raw HTML input reuses ChatGPT role-marked parser",()=>{
 const r=importPastedContent("<article data-role='user'><h2>Hello</h2></article><article data-role='assistant'><p>World</p></article>","html");
 assert.equal(r.conversation.messages.length,2);
 assert.equal(r.conversation.messages[0].blocks[0].type,"heading");
 assert.throws(()=>importPastedContent("<h1>No role here</h1>","html"),/no recognizable/);
});
test("Markdown raw HTML, javascript links and directives are not executable",()=>{
 const r=parseRichMarkdown("<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n**safe**");
 assert.ok(r.blocks.every(block=>block.type==="paragraph"));
 assert.match(r.blocks[0].children[0].text, /<script>/);
 assert.ok(r.warnings.some(w=>/Unsafe or unsupported link/.test(w)));
 assert.equal(globalThis.hacked,undefined);
});
test("ZIP importer reads only conversations.json and numbered JSON files",async()=>{
 const first=sample();const second={...sample(),id:"second",title:"Second archive chat"};
 const zip=zipSync({
  "conversations.json":strToU8(JSON.stringify([first])),
  "conversations-2.json":strToU8(JSON.stringify([second])),
  "user.json":strToU8(JSON.stringify({email:"secret@example.org"})),
 });
 const cat=await loadChatGPTExportFile(new File([zip],"my-chatgpt-export.zip"));
 assert.equal(cat.choices.length,2);
 assert.equal(cat.choices[1].title,"Second archive chat");
 assert.doesNotMatch(JSON.stringify(cat),/secret@example.org/);
});
test("JSON file supports single and array-form export",async()=>{
 const file=new File([JSON.stringify(sample())],"conversations.json");
 const result=await loadChatGPTExportFile(file);
 assert.equal(result.choices.length,1);
});
test("JSON ZIP with no recognized conversation files and invalid formats are rejected",async()=>{
 const fake=zipSync({"user.json":strToU8('{"private":true}')});
 await assert.rejects(loadChatGPTExportFile(new File([fake],"empty.zip")),/No ChatGPT conversations/);
 await assert.rejects(loadChatGPTExportFile(new File(["foo"],"malware.exe")),/Choose a ChatGPT/);
});
test("large pasted input and HTML samples are bounded",()=>{
 assert.throws(()=>importPastedContent("x".repeat(2_000_001),"text"),/2 MB/);
 assert.throws(()=>parseRichMarkdown("x".repeat(1_000_001)),/1 MB/);
});
