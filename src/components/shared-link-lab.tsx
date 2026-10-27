"use client";

import { useEffect, useRef, useState } from "react";
import { CAPTURE_HELP, CHATGPT_CAPTURE_BOOKMARKLET } from "@/lib/extractors/shared-page-bookmarklet";
import { PdfExportControls } from "@/components/pdf-export-controls";
import { inspectUserProvidedSharedHtml, type HtmlProbeResult } from "@/lib/extractors/shared-page-probe";
import { extractChatGPTConversationFromHtml, type HtmlExtractionResult } from "@/lib/extractors/chatgpt-html-extractor";
import type { ConversationData } from "@/lib/conversation/conversation";
import { parseConversationData } from "@/lib/conversation/validation";

type ValidatedResult =
  | { ok: true; canonicalUrl: string; retrieval: string; conversionReady: boolean; message: string; conversation?: ConversationData; warnings?: string[] }
  | { ok: false; code: string; message: string };

export function SharedLinkLab() {
  const [url, setUrl] = useState("");
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);
  const advancedRef = useRef<HTMLDetailsElement>(null);
  const [captureNotice, setCaptureNotice] = useState("");

  const [linkResult, setLinkResult] = useState<ValidatedResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [html, setHtml] = useState("");
  const [probe, setProbe] = useState<HtmlProbeResult | null>(null);
  const [extraction, setExtraction] = useState<HtmlExtractionResult | null>(null);
  const [probeError, setProbeError] = useState("");

  useEffect(() => {
    // React intentionally blocks javascript: hrefs. A user-installed bookmarklet
    // is the exception: we assign this constant-only URL to a draggable link.
    if (bookmarkletRef.current) bookmarkletRef.current.href = CHATGPT_CAPTURE_BOOKMARKLET;
  }, [linkResult]);


  async function inspectLink() {
    if (busy) return;
    setBusy(true);
    setLinkResult(null);
    setExtraction(null);
    setProbe(null);
    try {
      const response = await fetch("/api/shared-link/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ url, retrieve: true }),
      });
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !("ok" in payload)) throw new Error("Unexpected API response");
      if ("conversation" in payload) {
        const checked = parseConversationData(payload.conversation);
        if (!checked.ok) throw new Error("Invalid conversation response");
        payload.conversation = checked.data;
      }
      setLinkResult(payload as ValidatedResult);
    } catch {
      setLinkResult({ ok: false, code: "NETWORK_ERROR", message: "Could not inspect the link. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  function inspectHtml(sample = html) {
    setProbe(null);
    setExtraction(null);
    setProbeError("");
    if (!sample.trim()) {
      setProbeError("Paste the HTML source of a share page first.");
      return;
    }
    try {
      if(sample.length>2_000_000)throw new Error("HTML samples must be 2 MB or smaller.");
      setProbe(inspectUserProvidedSharedHtml(sample));
      setExtraction(extractChatGPTConversationFromHtml(sample, {
        sourceUrl: linkResult?.ok ? linkResult.canonicalUrl : undefined,
      }));
    } catch (error) {
      setProbeError(error instanceof Error ? error.message : "Could not inspect that HTML.");
    }
  }

  async function copyCaptureBookmarklet() {
    try {
      await navigator.clipboard.writeText(CHATGPT_CAPTURE_BOOKMARKLET);
      setCaptureNotice("Bookmarklet copied. Create a browser bookmark and paste this as its URL, or drag the capture link to your bookmarks bar.");
    } catch {
      setCaptureNotice("Clipboard access was blocked. Drag the capture link to your bookmarks bar instead.");
    }
  }

  async function importCapturedConversation() {
    setCaptureNotice("");
    try {
      if (!navigator.clipboard?.readText) throw new Error("This browser does not support reading the clipboard.");
      const captured = await navigator.clipboard.readText();
      if (!captured.trim().startsWith("<!doctype html") && !captured.trim().startsWith("<html")) {
        throw new Error("Clipboard does not contain captured HTML. First run the bookmarklet on the ChatGPT shared page.");
      }
      if (captured.length > 2_000_000) throw new Error("Captured HTML exceeds the 2 MB limit.");
      const source = /<meta\s+name=['"]chatpdf-capture-source['"]\s+content=['"]([^'"]+)['"]/i.exec(captured)?.[1];
      if (!linkResult?.ok || source !== linkResult.canonicalUrl) {
        throw new Error("Clipboard capture is not from the shared link you validated. Open that link and run the bookmarklet there.");
      }
      setHtml(captured);
      if (advancedRef.current) advancedRef.current.open = true;
      inspectHtml(captured);
      setCaptureNotice("Captured HTML imported locally. Review the messages and extraction warnings before saving your PDF.");
    } catch (error) {
      setCaptureNotice((error instanceof Error ? error.message : "Could not read the clipboard") + " " + CAPTURE_HELP);
    }
  }

  return (
    <section id="inspector" className="border-b border-[#e4ebe4] bg-white py-20 sm:py-24">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 lg:grid-cols-[.85fr_1.15fr] lg:gap-16 sm:px-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-[.19em] text-[#30815a]">Shared link to PDF</span>
          <h2 className="mt-4 max-w-md text-[clamp(2rem,3.2vw,2.7rem)] font-bold tracking-[-.045em] text-[#193a2c]">Convert a shared ChatGPT conversation.</h2>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-[#718778]">
            Paste a public shared link to import the conversation, review it, and save a PDF. Our server retrieves the public page; PDF formatting happens in your browser.
          </p>
          <div className="mt-6 rounded-xl border border-[#dce7dc] bg-[#f7fbf7] p-4 text-[13px] leading-6 text-[#54725c]">
            ChatGPT may block automatic access to some shares. Browser capture and file import remain available. Conversations are held in memory and are not saved in a database.
          </div>
        </div>

        <div className="rounded-2xl border border-[#e1eae1] bg-[#fcfdfb] p-5 shadow-[0_14px_45px_-34px_rgba(29,81,46,.25)] sm:p-7">
          <form onSubmit={(event) => { event.preventDefault(); void inspectLink(); }}>
            <label htmlFor="shared-link" className="text-[13px] font-bold text-[#244735]">ChatGPT shared link</label>
            <p className="mt-1 text-xs text-[#8a9a8d]">Only chatgpt.com/share/ links are supported.</p>
            <input id="shared-link" type="url" required placeholder="https://chatgpt.com/share/..." value={url}
              disabled={busy}
              onChange={(event) => { setUrl(event.target.value); setLinkResult(null); setExtraction(null); setProbe(null); setCaptureNotice(""); }}
              className="mt-4 w-full rounded-xl border border-[#d6e4d8] bg-white px-4 py-3.5 text-[13px] text-[#274432] outline-none transition placeholder:text-[#a5b2a7] focus:border-[#439668] focus:ring-2 focus:ring-[#cdebd5]" />
            <button type="submit" disabled={busy || !url.trim()}
              className="mt-3 w-full rounded-xl bg-[#174d36] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#136342] disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "Importing conversation…" : "Convert shared link to PDF"}
            </button>
          </form>

          {linkResult && (
            <div role="status" aria-live="polite" className={`mt-4 rounded-xl border p-4 text-[13px] leading-6 ${linkResult.ok ? "border-[#bcdac5] bg-[#f0f9f2] text-[#2c6642]" : "border-[#edc5bd] bg-[#fff6f3] text-[#995243]"}`}>
              <p className="font-bold">{linkResult.ok ? (linkResult.conversionReady ? "Conversation ready" : "Automatic import unavailable") : "Link not accepted"}</p>
              <p className="mt-1">{linkResult.message}</p>
              {linkResult.ok && (
                <a href={linkResult.canonicalUrl} rel="noopener noreferrer" target="_blank"
                  className="mt-2 inline-block break-all font-semibold underline underline-offset-2">
                  Open shared conversation on ChatGPT
                </a>
              )}
            </div>
          )}

          {linkResult?.ok && linkResult.conversation && (
            <div className="mt-5 rounded-xl border border-[#dce7dc] bg-white p-4 text-sm text-[#244735]">
              <h3 className="font-bold">{linkResult.conversation.title}</h3>
              <p className="mt-2 text-xs">{linkResult.conversation.messageCount} messages imported · review before saving</p>
              <div className="mt-3 max-h-80 space-y-3 overflow-auto">
                {linkResult.conversation.messages.map(message => (
                  <article key={message.id} className="rounded-lg border border-[#e3ebe3] p-3">
                    <p className="text-xs font-bold uppercase">{message.role}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5">{message.plainText}</p>
                  </article>
                ))}
              </div>
              {linkResult.warnings?.map((warning, i) => <p key={i} className="mt-2 text-xs text-[#876f36]">{warning}</p>)}
              <PdfExportControls key={linkResult.canonicalUrl} conversation={linkResult.conversation}/>
            </div>
          )}

          {linkResult?.ok && !linkResult.conversionReady && (
            <div className="mt-5 rounded-xl border border-[#dce7dc] bg-white p-4 text-[13px] leading-6 text-[#476651]">
              <p className="font-bold text-[#244735]">Capture the open conversation (without a server)</p>
              <p className="mt-1">Set up the capture bookmark once, then use it while viewing the shared conversation. This adapts the live-page approach used by your extension.</p>
              <ol className="mt-3 list-decimal space-y-1 pl-5">
                <li>Drag <strong>Capture ChatGPT</strong> below onto your browser bookmarks bar, or copy its code into a new bookmark URL.</li>
                <li>Open the shared link above. After it loads, click the Capture ChatGPT bookmark.</li>
                <li>Return here and select <strong>Import captured conversation</strong>. Review the PDF preview and save it.</li>
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <a ref={bookmarkletRef} href="#" onClick={(event) => event.preventDefault()}
                  title="Drag this to your browser bookmarks bar; clicking here does not capture"
                  className="inline-block cursor-grab rounded-lg border border-[#bddac5] bg-[#e9f5eb] px-3 py-2 text-xs font-bold text-[#2a7148]">
                  Capture ChatGPT (drag to bookmarks)
                </a>
                <button type="button" onClick={() => void copyCaptureBookmarklet()}
                  className="rounded-lg border border-[#bddac5] px-3 py-2 text-xs font-semibold text-[#2a7148]">
                  Copy bookmarklet code
                </button>
                <button type="button" onClick={() => void importCapturedConversation()}
                  className="rounded-lg bg-[#174d36] px-3 py-2 text-xs font-semibold text-white">
                  Import captured conversation
                </button>
              </div>
              {captureNotice && <p role="status" className="mt-3 text-xs text-[#476651]">{captureNotice}</p>}
              <p className="mt-3 text-xs text-[#827d5d]">This uses the visible, currently loaded DOM—not a verified full history. Nothing is automatically fetched from the shared URL by Vercel.</p>
            </div>
          )}

          <details ref={advancedRef} className="mt-6 border-t border-[#e3eae3] pt-5">
            <summary className="cursor-pointer text-[13px] font-semibold text-[#345d42]">Advanced: extract structured data from a saved HTML sample</summary>
            <p className="mt-3 text-xs leading-5 text-[#829386]">For development/testing: paste HTML source that you already have permission to access. Analysis stays in your browser. This extracts available semantic blocks locally and can open a printable PDF preview. It does not fetch shared links.</p>
            <label htmlFor="html-probe" className="mt-4 block text-xs font-bold text-[#476651]">HTML source</label>
            <textarea id="html-probe" rows={5} spellCheck={false} value={html} onChange={event => { setHtml(event.target.value); setProbe(null); setExtraction(null); setProbeError(""); }}
              placeholder={'<article data-message-author-role="user">Hello</article>'}
              className="mt-2 w-full resize-y rounded-lg border border-[#dbe7dd] bg-white p-3 font-mono text-[12px] leading-5 text-[#274432] outline-none focus:border-[#439668]" />
            <button type="button" onClick={() => inspectHtml()} className="mt-3 rounded-lg border border-[#bddac5] bg-[#eff8ef] px-4 py-2.5 text-xs font-bold text-[#2a7148] transition hover:bg-[#e2f3e5]">Extract HTML locally</button>
            {probeError && <p role="alert" className="mt-2 text-xs text-[#a04438]">{probeError}</p>}
            {probe && (
              <div className="mt-4 space-y-3 rounded-lg bg-[#f0f6f0] p-4 text-xs leading-5 text-[#395a42]" role="status">
                <p><strong>Result:</strong> {probe.kind.replaceAll("-", " ")} · {probe.messages.length} prototype message(s)</p>
                {probe.title && <p><strong>Title:</strong> {probe.title}</p>}
                <p><strong>Page signals:</strong> React stream {probe.signals.reactFlight ? "found" : "not found"}, JSON data {probe.signals.nextData ? "found" : "not found"}</p>
                {probe.messages.slice(0, 10).map((msg, i) => (
                  <div key={i} className="rounded-md border border-[#dfebdf] bg-white p-2.5"><strong>{msg.role}</strong><p className="mt-1 whitespace-pre-wrap break-words">{msg.text.slice(0, 1200)}</p></div>
                ))}
                {probe.messages.length > 10 && <p>Only the first 10 messages are shown in this prototype.</p>}
                {extraction?.conversation && (
                  <div className="space-y-3 rounded-lg border border-[#d0e5d7] bg-white p-3">
                    <p className="font-bold text-[#2a6543]">Structured conversation extracted (partial snapshot)</p>
                    <p>{extraction.conversation.stats.totalMessages} messages · {extraction.conversation.stats.userMessages} user · {extraction.conversation.stats.assistantMessages} assistant · {extraction.conversation.stats.codeBlocks} code block(s)</p>
                    <p>Rich blocks: {extraction.conversation.messages.reduce((sum, message) => sum + message.blocks.length, 0)} top-level blocks</p>
                    {extraction.conversation.messages.slice(0, 8).map((message) => (
                      <div key={message.id} className="rounded-md border border-[#e3ebe3] bg-[#fbfdfb] p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide">{message.role} · {message.blocks.map((block) => block.type).join(", ")}</p>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-5">{message.plainText.slice(0, 1500)}</pre>
                      </div>
                    ))}
                    {extraction.conversation.messages.length > 8 && <p>Showing the first eight messages of the local extraction.</p>}
                    <PdfExportControls conversation={extraction.conversation}/>
                  </div>
                )}
                {extraction?.warnings.slice(0, 10).map((warning, i) => (
                  <p key={i} className="text-[#876f36]">Extraction note: {warning}</p>
                ))}
                {probe.warnings.map((warning, i) => <p key={i} className="text-[#876f36]">Note: {warning}</p>)}
              </div>
            )}
          </details>
        </div>
      </div>
    </section>
  );
}
