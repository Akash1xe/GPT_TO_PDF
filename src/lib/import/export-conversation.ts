import type { ConversationData, ConversationMessage } from "@/lib/conversation/conversation";
import type { ContentBlock } from "@/lib/conversation/content";
import { buildConversationStats } from "@/lib/conversation/stats";
import { parseConversationData } from "@/lib/conversation/validation";
import { parseRichMarkdown } from "./markdown";
import { parseChatGPTRichMessage } from "./chatgpt-rich-message";

type JsonObject=Record<string,unknown>;
const MAX_CONVERSATIONS=10000, MAX_PATH=10000, MAX_PARTS=2000;
const MAX_TOTAL_MARKDOWN=12_000_000;
const MAX_MESSAGE_MARKDOWN=1_000_000;
const asObj=(v:unknown):JsonObject|null=>v!==null&&typeof v==="object"&&!Array.isArray(v)?v as JsonObject:null;
const asString=(v:unknown):string=>typeof v==="string"?v:"";
const asNonblank=(v:unknown)=>asString(v).trim();
const humanRole=(v:unknown):"user"|"assistant"|null=>v==="user"||v==="assistant"?v:null;
const note=(value:string):ContentBlock=>({type:"paragraph",children:[{type:"text",text:value}]});
const sourceFor=(id:string)=>"https://chatgpt.com/c/"+encodeURIComponent(id);
const safeId=(raw:string)=>/^[\w-]{1,200}$/.test(raw)?raw:"";
const capturedAt=(v:unknown):string=>{
  const epoch=typeof v==="number"&&Number.isFinite(v)?v*1000:typeof v==="string"?Date.parse(v):NaN;
  return Number.isFinite(epoch)&&epoch>=0&&epoch<8.64e15?new Date(epoch).toISOString():new Date().toISOString();
};
export interface ExportChoice { key:string; title:string; conversationId:string; messageNodes:number }
export interface ExportCatalog { choices:ExportChoice[]; raw:unknown[]; warnings:string[] }

/** List options before decoding rich message bodies (exports can be large). */
export function catalogChatGPTExports(input:unknown):ExportCatalog {
 const entries=Array.isArray(input)?input:[input];
 if(entries.length>MAX_CONVERSATIONS) throw Error("Too many conversations (10,000 maximum).");
 const choices:ExportChoice[]=[],raw:unknown[]=[],warnings:string[]=[];
 for(const item of entries){
  const obj=asObj(item);
  if(!obj || !asObj(obj.mapping)){warnings.push("A non-conversation JSON entry was skipped.");continue;}
  const identity=asNonblank(obj.id)||asNonblank(obj.conversation_id);
  const title=asNonblank(obj.title).slice(0,4096)||"Untitled conversation";
  const nodes=Object.keys(asObj(obj.mapping)!).length;
  if(nodes>100_000)throw Error("Conversation contains too many mapping nodes.");
  const key=String(raw.length);
  choices.push({key,title,conversationId:identity,messageNodes:nodes});
  raw.push(item);
 }
 if(!choices.length)throw Error("No ChatGPT conversations with a mapping were found.");
 return {choices,raw,warnings};
}

function selectedNodes(exported:JsonObject,warnings:string[]):JsonObject[]{
 const mapping=asObj(exported.mapping);
 if(!mapping)throw Error("Conversation mapping is missing.");
 const nodeIds=Object.keys(mapping);
 if(nodeIds.length>100_000)throw Error("Conversation mapping contains too many nodes.");
 let cursor=asNonblank(exported.current_node);
 if(!cursor){
  // Without an explicit active tip, a single chain can still be recovered
  // unambiguously. Edited/regenerated sibling branches cannot be guessed.
  const parents=new Set<string>();
  for(const item of Object.values(mapping)){
   const parent=asNonblank(asObj(item)?.parent);
   if(parent)parents.add(parent);
  }
  const leaves=nodeIds.filter(id=>!parents.has(id));
  if(leaves.length!==1)throw Error("Export lacks current_node and has multiple branches; select an export with an active branch.");
  cursor=leaves[0];
  warnings.push("No current_node was provided; a single unambiguous path was recovered.");
 }
 const seen=new Set<string>(),list:JsonObject[]=[];
 while(cursor){
  if(seen.has(cursor))throw Error("Cycle detected in the conversation parent chain.");
  if(seen.size>=MAX_PATH)throw Error("Conversation branch exceeds 10,000 nodes.");
  seen.add(cursor);
  if(!Object.hasOwn(mapping,cursor))throw Error("Conversation references a missing active-branch node.");
  const item=asObj(mapping[cursor]);
  if(!item)throw Error("Conversation references a missing active-branch node.");
  list.push(item);
  cursor=asNonblank(item.parent);
 }
 return list.reverse();
}

function attachments(content:JsonObject,parts:unknown[],warnings:string[]):{ markdown:string; placeholders:ContentBlock[] } {
 const textParts:string[]=[],placeholders:ContentBlock[]=[];
 let size=0;
 const push=(text:string)=>{
  size+=text.length+2;
  if(size>MAX_MESSAGE_MARKDOWN)throw Error("Exported message exceeds the 1 MB rich-text limit.");
  textParts.push(text);
 };
 for(const part of parts.slice(0,MAX_PARTS)){
  if(typeof part==="string"){push(part);continue;}
  const record=asObj(part);
  if(!record)continue;
  if(typeof record.text==="string"){push(record.text);continue;}
  const kind=asNonblank(record.content_type)||asNonblank(record.type)||"attachment";
  // Export JSON commonly references images/audio/assets without embedding
  // their bytes. Do not generate fictitious URLs or fetch anything.
  placeholders.push(note("[Unavailable "+kind.replace(/[^\w -]/g,"").slice(0,50)+" attachment]"));
  warnings.push("An exported media/attachment part contains metadata only; its pixels or bytes were not reconstructed.");
 }
 if(parts.length>MAX_PARTS)warnings.push("A message's parts were truncated at 2,000.");
 if(!parts.length && typeof content.text==="string")push(content.text);
 return {markdown:textParts.join("\n\n"),placeholders};
}

export function importExportedConversation(input:unknown):{ conversation:ConversationData; warnings:string[] }{
 const raw=asObj(input);
 if(!raw)throw Error("Expected a ChatGPT conversation object.");
 const warnings:string[]=[];
 const branch=selectedNodes(raw,warnings);
 const turnId=(msg:JsonObject)=>asNonblank(asObj(msg.metadata)?.turn_exchange_id);
 const finalTurns=new Set(branch.map(item=>asObj(item.message)).filter((msg):msg is JsonObject=>Boolean(msg && msg.channel==="final" && asObj(msg.author)?.role==="assistant" && asObj(msg.metadata)?.is_visually_hidden_from_conversation!==true)).map(turnId).filter(Boolean));
 const generatedImages=new Map<string,ContentBlock[]>();
 for(const item of branch){
  const msg=asObj(item.message),metadata=asObj(msg?.metadata);
  if(!msg||asObj(msg.author)?.role!=="tool"||!metadata?.image_gen_title||metadata.is_visually_hidden_from_conversation===true)continue;
  const parts=asObj(msg.content)?.parts;
  if(!Array.isArray(parts))continue;
  const images:ContentBlock[]=parts.flatMap(part=>{
   const asset=asObj(part);
   if(asset?.content_type!=="image_asset_pointer")return [];
   return [{type:"image" as const,mediaKind:"image" as const,sourceType:"unknown" as const,
    alt:asString(metadata.image_gen_title)||"Generated image",caption:"The shared page includes a generated image, but only its internal file reference was supplied. Use browser capture or import HTML with embedded image data to include it."}];
  });
  if(images.length&&turnId(msg))generatedImages.set(turnId(msg),[...(generatedImages.get(turnId(msg))??[]),...images]);
 }
 const messages:ConversationMessage[]=[];
 const seenMessageIds=new Set<string>();
 let totalMarkdown=0;
 for(const item of branch){
  const msg=asObj(item.message);
  if(!msg)continue;
  const role=humanRole(asObj(msg.author)?.role);
  if(!role)continue; // Ignore system/tool messages; don't misattribute.
  if(asObj(msg.metadata)?.is_visually_hidden_from_conversation === true)continue;
  if(typeof msg.recipient === "string" && msg.recipient !== "all")continue;
  if(msg.channel === "analysis" || msg.channel === "justify" || msg.channel === "confidence")continue;
  if(msg.channel === "commentary" && asObj(msg.metadata)?.is_thinking_preamble_message === true && finalTurns.has(turnId(msg)))continue;
  const content=asObj(msg.content);
  if(!content)continue;
  if(["thoughts","reasoning_recap","model_editable_context","user_editable_context"].includes(asString(content.content_type)))continue;
  const parts=Array.isArray(content.parts)?content.parts:[];
  const {markdown,placeholders}=attachments(content,parts,warnings);
  totalMarkdown+=markdown.length;
  if(totalMarkdown>MAX_TOTAL_MARKDOWN)throw Error("Selected branch exceeds the 12 MB text budget.");
  const parsed=markdown.trim()?(role==="assistant"?parseChatGPTRichMessage(markdown,msg.metadata):parseRichMarkdown(markdown)):{blocks:[],plainText:"",warnings:[] as string[]};
  warnings.push(...parsed.warnings);
  const generated=role==="assistant"&&msg.channel==="final"?generatedImages.get(turnId(msg))??[]:[];
  if(generated.length){generatedImages.delete(turnId(msg));warnings.push("A generated image was retained as a labeled placeholder because the share supplies an internal file reference, not public image bytes.");}
  const blocks:ContentBlock[]=[...parsed.blocks,...placeholders,...generated];
  const plainText=[parsed.plainText,...generated.map(p=>p.type==="image"?p.alt:"") ,...placeholders.map(p=>p.type==="paragraph"?p.children.map(x=>x.type==="text"?x.text:"").join(""):"")].filter(Boolean).join("\n");
  if(!blocks.length&&!plainText.trim())continue;
  const id=(asNonblank(msg.id)||asNonblank(item.id)||"export:"+messages.length).slice(0,500);
  if(seenMessageIds.has(id)) {
    warnings.push("A duplicate exported message identifier was disambiguated.");
  }
  const uniqueId=seenMessageIds.has(id)?id.slice(0,470)+":branch-"+messages.length:id;
  seenMessageIds.add(uniqueId);
  messages.push({id:uniqueId,role,order:messages.length,plainText,blocks,identityQuality:"strong"});
 }
 if(!messages.length)throw Error("The selected conversation has no readable user or assistant messages on its active path.");
 if(messages.length>MAX_PATH)throw Error("Conversation contains too many readable messages.");
 const convId=safeId(asNonblank(raw.id)||asNonblank(raw.conversation_id));
 const source=convId?sourceFor(convId):"https://chatgpt.com/";
 const completeness={state:"possibly-partial" as const,reason:"unknown" as const,collectedMessages:messages.length,
  verifiedBeginning:false,verifiedEnd:false,continuityVerified:false};
 warnings.push("The export's active message branch was used; full media assets, tool results and any inaccessible branches were not imported.");
 const draft:ConversationData={provider:"chatgpt",title:asNonblank(raw.title).slice(0,4096)||"ChatGPT conversation",
  url:source,capturedUrl:source,capturedAt:capturedAt(raw.create_time),...(convId?{conversationId:convId}:{}),
  messageCount:messages.length,possiblyPartial:true,completeness,messages,stats:buildConversationStats(messages)};
 const checked=parseConversationData(draft);
 if(!checked.ok)throw Error("Export could not be normalized: "+checked.issues[0]?.message);
 return {conversation:checked.data,warnings:[...new Set([...warnings,...checked.warnings])]};
}
