import type { ConversationData, ConversationMessage } from "@/lib/conversation/conversation";
import { buildConversationStats } from "@/lib/conversation/stats";
import { parseConversationData } from "@/lib/conversation/validation";
import { extractChatGPTConversationFromHtml } from "@/lib/extractors/chatgpt-html-extractor";
import { parseRichMarkdown, parseLiteralText } from "./markdown";
export type PasteFormat="text"|"markdown"|"html";
const HEADER=/^(?:#{1,4}\s*)?(User|Assistant|You said|ChatGPT said)\s*:\s*(.*)$/i;
export function importPastedContent(value:string,format:PasteFormat):{conversation:ConversationData;warnings:string[]}{
 if(!value.trim())throw Error("Paste some conversation content first.");
 if(value.length>2_000_000)throw Error("Pasted input exceeds the 2 MB limit.");
 if(format==="html"){
  const result=extractChatGPTConversationFromHtml(value);
  if(!result.conversation)throw Error("HTML contains no recognizable ChatGPT user/assistant messages.");
  return {conversation:result.conversation,warnings:result.warnings};
 }
 const warnings:string[]=[];
 const parts:Array<{role:"user"|"assistant";content:string}>=[];
 let current:{role:"user"|"assistant";lines:string[]}|null=null;
 let fenceMarker="";
 for(const line of value.replace(/\r\n?/g,"\n").split("\n")){
  // Role labels inside fenced code are data, not conversation boundaries.
  const fence=/^\s*(`{3,}|~{3,})/.exec(line);
  if(format==="markdown" && fence){
    const mark=fence[1];
    if(!fenceMarker)fenceMarker=mark;
    else if(mark[0]===fenceMarker[0] && mark.length>=fenceMarker.length)fenceMarker="";
  }
  const matched=fenceMarker?null:HEADER.exec(line.trim());
  if(matched){
   if(current&&current.lines.join("\n").trim())parts.push({role:current.role,content:current.lines.join("\n")});
   current={role:/assistant|chatgpt/i.test(matched[1])?"assistant":"user",lines:matched[2]?[matched[2]]:[]};
  }else if(current)current.lines.push(line);
 }
 if(current&&current.lines.join("\n").trim())parts.push({role:current.role,content:current.lines.join("\n")});
 if(!parts.length){
  parts.push({role:"user",content:value});
  warnings.push("No User:/Assistant: boundaries were detected; imported as one user message.");
 }else if(parts.map(p=>p.content).join("\n").length<value.trim().length/3){
  warnings.push("Text before the first role heading may not have been included.");
 }
 const messages:ConversationMessage[]=parts.map((part,i)=>{
  const parsed=format==="markdown"?parseRichMarkdown(part.content):{...parseLiteralText(part.content),warnings:[]};
  warnings.push(...parsed.warnings);
  return {id:"paste:"+i,role:part.role,order:i,plainText:parsed.plainText,
   blocks:parsed.blocks,identityQuality:"contextual" as const};
 });
 if(messages.length>10000)throw Error("Too many pasted messages.");
 const conversation:ConversationData={provider:"chatgpt",title:"Pasted conversation",
  url:"https://chatgpt.com/",capturedUrl:"https://chatgpt.com/",capturedAt:new Date().toISOString(),
  messageCount:messages.length,possiblyPartial:true,
  completeness:{state:"possibly-partial",reason:"unknown",collectedMessages:messages.length,verifiedBeginning:false,verifiedEnd:false,continuityVerified:false},
  messages,stats:buildConversationStats(messages)};
 const checked=parseConversationData(conversation);
 if(!checked.ok)throw Error("Pasted content is invalid: "+checked.issues[0]?.message);
 return {conversation:checked.data,warnings:[...new Set([...warnings,...checked.warnings])]};
}
