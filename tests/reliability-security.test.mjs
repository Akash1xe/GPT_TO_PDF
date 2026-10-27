import assert from "node:assert/strict";
import test from "node:test";
import { File } from "node:buffer";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { zipSync, strToU8 } from "fflate";
import { loadChatGPTExportFile } from "../src/lib/import/file-import.ts";
import { catalogChatGPTExports, importExportedConversation } from "../src/lib/import/export-conversation.ts";
import { importPastedContent } from "../src/lib/import/pasted-content.ts";
import { parseConversationData } from "../src/lib/conversation/validation.ts";
import { preparePrintPayload } from "../src/lib/pdf/print-job.ts";

const fixture=(name)=>readFileSync(fileURLToPath(new URL("./fixtures/"+name,import.meta.url)),"utf8");
const exportJSON=()=>JSON.parse(fixture("export-branches.json"))[0];

test("realistic HTML snapshot preserves order, code, math, table, SVG, card and safe placeholder",()=>{
 const {conversation,warnings}=importPastedContent(fixture("realistic-conversation.html"),"html");
 assert.equal(conversation.messages.length,3);
 assert.deepEqual(conversation.messages.map(m=>m.role),["user","assistant","user"]);
 const blocks=conversation.messages[1].blocks;
 assert.ok(blocks.some(b=>b.type==="heading"));
 assert.ok(blocks.some(b=>b.type==="ordered-list"));
 assert.ok(blocks.some(b=>b.type==="code"));
 assert.ok(blocks.some(b=>b.type==="table"));
 assert.ok(blocks.some(b=>b.type==="image"&&b.mediaKind==="svg"));
 assert.ok(blocks.some(b=>b.type==="image"&&b.src===undefined));
 assert.ok(blocks.some(b=>b.type==="layout"));
 assert.ok(conversation.stats.mathNodes>=1);
 assert.ok(conversation.stats.images>=2);
 assert.doesNotMatch(JSON.stringify(conversation),/window\.__injected|javascript:alert/);
 assert.ok(warnings.length>0);
 assert.equal(parseConversationData(conversation).ok,true);
});

test("real export fixture selects edited reply and reports missing media",()=>{
 const raw=exportJSON();
 const {conversation,warnings}=importExportedConversation(raw);
 assert.deepEqual(conversation.messages.map(m=>m.id),["user","reply-b"]);
 assert.ok(conversation.messages[1].blocks.some(b=>b.type==="code"));
 assert.ok(conversation.messages[1].blocks.some(b=>b.type==="heading"));
 assert.doesNotMatch(JSON.stringify(conversation),/Old regenerated reply|file-service:\/\//);
 assert.ok(warnings.some(w=>/metadata only/.test(w)));
 assert.equal(preparePrintPayload(conversation,{messageFilter:"all"}).conversation.messages.length,2);
});

test("import rejects prototype chain pseudo-node identifiers",()=>{
 for(const id of ["__proto__","constructor","toString"]){
  const raw=exportJSON();raw.current_node=id;
  assert.throws(()=>importExportedConversation(raw),/missing active-branch node/);
 }
});

test("source mapping and ZIP limits reject crafted archive members",async()=>{
 const malformed=new File([Uint8Array.from([0,1,2,3,4])],"export.zip");
 await assert.rejects(loadChatGPTExportFile(malformed),/valid ZIP local-file header/);
 const compressedBomb=zipSync({"conversations.json":strToU8("x".repeat(1_500_000))});
 await assert.rejects(loadChatGPTExportFile(new File([compressedBomb],"export.zip")),/Suspicious ZIP compression ratio/);
 const many=Object.fromEntries(Array.from({length:31},(_,i)=>["conversations-"+i+".json",strToU8("[]")]));
 await assert.rejects(loadChatGPTExportFile(new File([zipSync(many)],"export.zip")),/Too many\/oversized/);
});

test("unknown ZIP members are not evaluated or imported as private data",async()=>{
 const raw=exportJSON();
 const archive=zipSync({
  "conversations.json":strToU8(JSON.stringify([raw])),
  "../../user.json":strToU8('{"api_key":"should-not-load"}'),
  "attachments/image.jpg":strToU8("private raster"),
 });
 const catalog=await loadChatGPTExportFile(new File([archive],"export.zip"));
 assert.equal(catalog.choices.length,1);
 assert.doesNotMatch(JSON.stringify(catalog),/should-not-load|private raster/);
});

test("literal role headings inside Markdown code fences are not treated as new messages",()=>{
 const pasted="User:\nShow code.\n\nAssistant:\n```txt\nUser:\nFake\nAssistant:\nNot a real reply\n```\n\nEnd.";
 const {conversation}=importPastedContent(pasted,"markdown");
 assert.equal(conversation.messages.length,2);
 assert.equal(conversation.messages[1].role,"assistant");
 assert.ok(conversation.messages[1].blocks.some(b=>b.type==="code"));
 assert.match(conversation.messages[1].plainText,/Not a real reply/);
});

test("malformed and oversized data is handled with controlled errors",()=>{
 const raw=exportJSON();
 raw.mapping["reply-b"].message.content.parts=[ "x".repeat(500_000), "y".repeat(500_000) ];
 assert.throws(()=>importExportedConversation(raw),/1 MB rich-text limit/);
 assert.throws(()=>catalogChatGPTExports([{mapping:Object.fromEntries(Array.from({length:100_001},(_,i)=>["x"+i,{}]))}]),/too many mapping nodes/);
});

test("1200-message linear active branch remains ordered under bounded runtime",()=>{
 const mapping={root:{id:"root",parent:null,message:null}};
 let parent="root";
 for(let i=0;i<1200;i++){
  const id="turn-"+i;
  mapping[id]={id,parent,message:{id,author:{role:i%2?"assistant":"user"},
    content:{content_type:"text",parts:["## Turn "+i+"\n\nResult index "+i]}}};
  parent=id;
 }
 const raw={mapping,current_node:parent,title:"Large conversation",id:"perf-test"};
 const start=performance.now();
 const {conversation}=importExportedConversation(raw);
 const elapsed=performance.now()-start;
 assert.equal(conversation.messageCount,1200);
 assert.equal(conversation.messages[1199].plainText.includes("1199"),true);
 assert.equal(conversation.messages[0].role,"user");
 assert.equal(parseConversationData(conversation).ok,true);
 assert.ok(elapsed<20_000,`Unexpectedly slow import (${Math.round(elapsed)} ms)`);
});
