import test from "node:test";
import assert from "node:assert/strict";
import { parseChatGPTRichMessage } from "../src/lib/import/chatgpt-rich-message.ts";
import { importExportedConversation } from "../src/lib/import/export-conversation.ts";

const metadata=(tree,extra={})=>({model_dil_v2:{code:`DIL.render(__dil.jsx(()=>{const __dilConstants=DIL.useConstants(); return ${tree};}));`,constants:{heading:"Three choices",body:"Readable content",code:"const x = '<box>';"},...extra}});
const jsx=(name,props="null",...children)=>`__dil.jsx(${JSON.stringify(name)},${props}${children.length?","+children.join(","):""})`;
const text=(s)=>jsx("text","null",JSON.stringify(s));

test("declarative ChatGPT cards, links and lists become semantic content instead of JSX text",()=>{
 const tree=jsx("box",'{border:true,background:"surface-secondary"}',
  jsx("title",'{size:"lg"}','__dilConstants["heading"]'),
  jsx("row","null",text("First choice"),text("Second choice")),
  jsx("list",'{marker:"number"}',jsx("list-item","null",text("One")),jsx("list-item","null",text("Two"))),
  '__dil.jsx(Link,{url:"https://example.com",title:"Reference"})');
 const result=parseChatGPTRichMessage('<box>RAW_UI</box>',metadata(tree));
 assert.equal(result.blocks[0].type,"layout");
 assert.equal(result.blocks[0].card,true);
 assert.match(result.plainText,/Three choices/);
 assert.match(result.plainText,/Reference/);
 assert.doesNotMatch(result.plainText,/<box|RAW_UI|__dil/);
 const serialized=JSON.stringify(result.blocks);
 assert.match(serialized,/ordered-list/);
 assert.match(serialized,/https:\/\/example.com\//);
});

test("metadata callbacks and statements are never executed; unsupported expressions use the text alternative",()=>{
 globalThis.__chatpdfUnsafe=0;
 const meta=metadata(jsx("button",'{onClick:()=>{globalThis.__chatpdfUnsafe=1},style:{background:"url(https://evil.test)"}}',JSON.stringify("Review")));
 meta.model_dil_v2.code='globalThis.__chatpdfUnsafe=2;'+meta.model_dil_v2.code;
 const result=parseChatGPTRichMessage("original",meta);
 assert.equal(globalThis.__chatpdfUnsafe,0);
 assert.equal(result.plainText,"Review");
 assert.doesNotMatch(JSON.stringify(result),/evil\.test|onClick|__chatpdfUnsafe/);
 const fallback=parseChatGPTRichMessage("original",metadata('fetch("https://evil.test")',{fallbackMarkdown:"Safe alternative urlGuidehttps://example.com/guide"}));
 assert.match(fallback.plainText,/Safe alternative Guide/);
 assert.doesNotMatch(fallback.plainText,/|evil/);
 delete globalThis.__chatpdfUnsafe;
});

test("code strings, citation targets and the default radio state survive inert UI reconstruction",()=>{
 const tree=jsx("fragment","null",jsx("code-block",'{language:"js"}','__dilConstants["code"]'),
  jsx("radio-group",'{value:"yes"}',jsx("radio",'{value:"yes"}',JSON.stringify("Yes")),jsx("radio",'{value:"no"}',JSON.stringify("No"))),
  '__dil.jsx(Cite,{refs:["turn123search0"]})');
 const meta=metadata(tree);
 meta.search_result_groups=[{entries:[{ref_id:{turn_index:123,ref_type:"search",ref_index:0},url:"https://example.com/source",title:"Primary source"}]}];
 const result=parseChatGPTRichMessage("raw",meta);
 assert.equal(result.blocks[0].type,"code");
 assert.equal(result.blocks[0].code,"const x = '<box>';");
 assert.equal(result.blocks[1].checked,true);
 assert.equal(result.blocks[2].checked,false);
 assert.match(JSON.stringify(result.blocks),/https:\/\/example.com\/source/);
 assert.doesNotMatch(result.plainText,/turn123/);
});

test("resolved AsyncImage metadata preserves a public image without requesting it",()=>{
 const meta=metadata('__dil.jsx(AsyncImage,{__resolutionId:"image-1",query:"Illustrated steps"})',{
  appData:{opGenui:{componentResults:{"image-1":{state:{images:[{content_url:"https://images.example.com/steps.png",title:"Step illustration",content_size:{width:621,height:454}}]}}}}},
 });
 const result=parseChatGPTRichMessage("<AsyncImage />",meta);
 assert.equal(result.blocks[0].type,"image");
 assert.equal(result.blocks[0].src,"https://images.example.com/steps.png");
 assert.equal(result.blocks[0].width,621);
 assert.equal(result.blocks[0].alt,"Step illustration");
});

test("image-only generated replies remain in order, and replaced progress preambles do not duplicate final answers",()=>{
 const message=(id,role,parts,extra={})=>({id,author:{role},content:{content_type:"text",parts},metadata:{turn_exchange_id:"turn-1"},...extra});
 const data={title:"Images",current_node:"final",mapping:{
  user:{parent:null,message:message("u","user",["Draw instructions"])},
  progress:{parent:"user",message:message("p","assistant",["Working..."],{channel:"commentary",metadata:{turn_exchange_id:"turn-1",is_thinking_preamble_message:true}})},
  image:{parent:"progress",message:message("i","tool",[{content_type:"image_asset_pointer",asset_pointer:"sediment://file_private"}],{metadata:{turn_exchange_id:"turn-1",image_gen_title:"Instructions"}})},
  final:{parent:"image",message:message("f","assistant",[""],{channel:"final"})},
 }};
 const result=importExportedConversation(data);
 assert.equal(result.conversation.messageCount,2);
 assert.equal(result.conversation.messages[1].blocks[0].type,"image");
 assert.equal(result.conversation.messages[1].blocks[0].src,undefined);
 assert.doesNotMatch(JSON.stringify(result.conversation),/Working|file_private/);
 assert.ok(result.warnings.some(w=>/generated image/.test(w)));
});
