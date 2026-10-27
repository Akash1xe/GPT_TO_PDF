"use client";

import { useState, type ChangeEvent } from "react";
import type { ConversationData } from "@/lib/conversation/conversation";
import { PdfExportControls } from "@/components/pdf-export-controls";
import { importExportedConversation, type ExportCatalog } from "@/lib/import/export-conversation";
import { loadChatGPTExportFile } from "@/lib/import/file-import";
import { importPastedContent, type PasteFormat } from "@/lib/import/pasted-content";

type Imported = { conversation:ConversationData;warnings:string[] };

export function ImportStudio() {
 const [mode,setMode]=useState<PasteFormat>("markdown");
 const [pasted,setPasted]=useState("");
 const [catalog,setCatalog]=useState<ExportCatalog|null>(null);
 const [selected,setSelected]=useState("0");
 const [loaded,setLoaded]=useState<Imported|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [name,setName]=useState("");

 const reset=()=>{setLoaded(null);setCatalog(null);setSelected("0");setError("");};
 const selectExport=(index:string,source:ExportCatalog|null=catalog)=>{
  setSelected(index);setError("");setLoaded(null);
  if(!source)return;
  try{
   const item=source.raw[Number(index)];
   if(item===undefined)throw Error("Selected conversation was not found.");
   const imported=importExportedConversation(item);
   setLoaded({...imported,warnings:[...source.warnings,...imported.warnings]});
  }catch(e){setError(e instanceof Error?e.message:"Unable to read the selected conversation.");}
 };
 const paste=()=>{
  reset();
  try{setLoaded(importPastedContent(pasted,mode));}
  catch(e){setError(e instanceof Error?e.message:"Unable to interpret pasted content.");}
 };
 const fileSelected=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];reset();setName(file?.name??"");if(!file)return;
  setBusy(true);
  try{
   if(file.size>35_000_000)throw Error("File exceeds the 35 MB import limit.");
   const lower=file.name.toLowerCase();
   if(lower.endsWith(".zip")||lower.endsWith(".json")){
    const next=await loadChatGPTExportFile(file);
    setCatalog(next);
    selectExport("0",next);
   }else if(lower.endsWith(".html")||lower.endsWith(".htm")||lower.endsWith(".md")||lower.endsWith(".txt")){
    const text=await file.text();
    const format:PasteFormat=lower.endsWith(".html")||lower.endsWith(".htm")?"html":lower.endsWith(".md")?"markdown":"text";
    setLoaded(importPastedContent(text,format));
   }else throw Error("Supported formats: ZIP, JSON, HTML, MD or TXT.");
  }catch(e){setError(e instanceof Error?e.message:"Could not import this file.");}
  finally{setBusy(false);event.target.value="";}
 };

 return (
  <section id="import-studio" className="bg-[#f8fbf7] py-20 sm:py-24">
   <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
    <div className="max-w-2xl">
     <p className="text-xs font-bold uppercase tracking-[.18em] text-[#347c53]">Import safely · browser-local</p>
     <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#193a2c]">Import a conversation from a file or text</h2>
     <p className="mt-3 text-sm leading-7 text-[#667d6d]">
      Your files are read locally in this browser. Nothing is uploaded to our server. ChatGPT exports can
      contain sensitive information; choose the specific conversation you want to print.
     </p>
    </div>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
     <div className="rounded-2xl border border-[#dae9dc] bg-white p-5 sm:p-7">
      <h3 className="font-semibold text-[#254b35]">Import a file</h3>
      <p className="mt-2 text-xs leading-6 text-[#738a79]">
       Choose a ChatGPT data export (.zip or conversations*.json), an HTML snapshot, Markdown (.md), or plain text (.txt).
       Maximum upload size 35 MB. ZIPs only unpack recognized conversation JSON files.
      </p>
      <label htmlFor="conversation-file" className="mt-4 block text-xs font-bold text-[#315c40]">Choose file</label>
      <input id="conversation-file" type="file" accept=".zip,.json,.html,.htm,.md,.txt" onChange={event=>void fileSelected(event)}
       disabled={busy} className="mt-2 block w-full rounded-lg border border-[#dbe7de] p-3 text-sm text-[#345741] file:mr-3 file:rounded-md file:border-0 file:bg-[#eaf4eb] file:px-3 file:py-2 file:font-bold file:text-[#1d6944]"/>
      {name&&<p className="mt-2 break-all text-xs text-[#6d8c76]">File: {name}{busy?" (reading locally…)":""}</p>}
      {catalog&&(
       <div className="mt-5">
        <label htmlFor="export-choice" className="text-xs font-bold text-[#315c40]">Choose a conversation from the export ({catalog.choices.length})</label>
        <select id="export-choice" value={selected} onChange={event=>selectExport(event.target.value)}
         className="mt-2 w-full rounded-lg border border-[#dbe7de] bg-white px-3 py-3 text-sm">
         {catalog.choices.map(item=><option key={item.key} value={item.key}>
          {item.title.slice(0,85)} ({item.messageNodes} nodes)
         </option>)}
        </select>
        <p className="mt-2 text-xs text-[#937034]">Only the active reply branch is imported. Missing media are noted, never invented.</p>
       </div>
      )}
     </div>
     <div className="rounded-2xl border border-[#dae9dc] bg-white p-5 sm:p-7">
      <h3 className="font-semibold text-[#254b35]">Paste content</h3>
      <label htmlFor="paste-format" className="mt-3 block text-xs font-bold text-[#315c40]">Content format</label>
      <select id="paste-format" value={mode} onChange={event=>{setMode(event.target.value as PasteFormat);reset();}}
       className="mt-2 w-full rounded-lg border border-[#dbe7de] bg-white px-3 py-3 text-sm">
       <option value="markdown">Markdown (headings, code, tables, math sources)</option>
       <option value="text">Plain text</option>
       <option value="html">ChatGPT HTML snapshot (role-marked)</option>
      </select>
      <label htmlFor="paste-content" className="mt-4 block text-xs font-bold text-[#315c40]">Conversation text</label>
      <textarea id="paste-content" rows={7} maxLength={2_000_000} spellCheck={false} value={pasted}
       onChange={event=>{setPasted(event.target.value);reset();}}
       placeholder={"User:\nExplain binary search.\n\nAssistant:\n## Binary search\nSearch the sorted array in halves."}
       className="mt-2 w-full rounded-lg border border-[#dbe7de] bg-white p-3 font-mono text-xs leading-6"/>
      <button type="button" onClick={paste} disabled={!pasted.trim()||busy}
       className="mt-3 rounded-lg bg-[#174d36] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Import pasted content</button>
      <p className="mt-2 text-xs leading-5 text-[#7c917f]">
       Use User: and Assistant: on separate lines to separate messages. Without role labels, pasted text becomes one user message.
      </p>
     </div>
    </div>
    {error&&<p className="mt-5 rounded-xl border border-[#ebcfbc] bg-[#fff7f3] p-4 text-sm text-[#9d4934]" role="alert">{error}</p>}
    {loaded&&(
     <div className="mt-7 rounded-2xl border border-[#cfe3d3] bg-white p-5 sm:p-7" role="status" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
       <div>
        <h3 className="text-lg font-bold text-[#21533a]">{loaded.conversation.title}</h3>
        <p className="mt-1 text-xs text-[#62836e]">{loaded.conversation.messageCount} imported messages · {loaded.conversation.stats.codeBlocks} code blocks · {loaded.conversation.stats.mathNodes} math expressions</p>
       </div>
       <span className="rounded-full bg-[#fff3dc] px-3 py-1.5 text-xs font-semibold text-[#92662d]">Possibly partial</span>
      </div>
      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-lg bg-[#f7faf7] p-3">
       {loaded.conversation.messages.slice(0,12).map(message=>(
        <div key={message.id} className="rounded-md border border-[#dfe9e1] bg-white p-3 text-xs">
         <strong className="uppercase tracking-wide text-[#345b44]">{message.role}</strong>
         <p className="mt-1 whitespace-pre-wrap break-words text-[#415b47]">{message.plainText.slice(0,350)}</p>
        </div>
       ))}
       {loaded.conversation.messages.length>12&&<p className="text-xs">Showing first 12 messages.</p>}
      </div>
      {loaded.warnings.length>0&&
       <details className="mt-4">
        <summary className="cursor-pointer text-xs font-semibold text-[#93672b]">Import warnings ({loaded.warnings.length})</summary>
        {loaded.warnings.slice(0,12).map((warning,i)=><p key={i} className="mt-2 text-xs text-[#976f3e]">{warning}</p>)}
       </details>}
      <PdfExportControls conversation={loaded.conversation}/>
     </div>
    )}
   </div>
  </section>
 );
}
