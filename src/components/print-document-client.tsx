"use client";

import { useEffect, useRef, useState } from "react";
import { renderConversation, safePdfTitle } from "@/lib/pdf/conversation-renderer";
import { buildPrintStyles } from "@/lib/pdf/print-styles";
import { PRINT_DOCUMENT, PRINT_READY, preparePrintPayload } from "@/lib/pdf/print-job";
import { renderMermaidDiagrams } from "@/lib/pdf/mermaid-renderer";
import { markUnavailableImages } from "@/lib/pdf/image-renderer";

async function readyForPrinting(document: Document): Promise<number> {
  const pending = Array.from(document.images).filter((img) => !img.complete);
  const images = Promise.all(pending.map((img) => new Promise<void>((resolve) => {
    img.addEventListener("load", () => resolve(), { once: true });
    img.addEventListener("error", () => resolve(), { once: true });
  })));
  // Remote assets may fail or hang. Never block Save as PDF indefinitely.
  const wait = (work: Promise<unknown>, maximum: number) => Promise.race([
    work.then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, maximum)),
  ]);
  await Promise.all([
    wait(images, 12_000),
    document.fonts ? wait(document.fonts.ready, 4000) : Promise.resolve(),
  ]);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  return markUnavailableImages(document);
}

export function PrintDocumentClient() {
  const root = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);
  const printTitle = useRef("ChatGPT Conversation");
  const [status, setStatus] = useState("Waiting for conversation data from the import page…");
  const [available, setAvailable] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!window.opener) return;
    let announced = false;
    let disposed = false;
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.opener) return;
      if (loaded.current || !event.data || event.data.type !== PRINT_DOCUMENT) return;
      try {
        const validated = preparePrintPayload(event.data.conversation, event.data.preferences, event.data.allowExternalImages === true);
        const style = document.createElement("style");
        style.dataset.chatpdfPrint = "true";
        style.textContent = buildPrintStyles(validated.preferences);
        document.head.querySelectorAll("style[data-chatpdf-print]").forEach((element) => element.remove());
        document.head.appendChild(style);
        printTitle.current = safePdfTitle(validated.conversation.title);
        document.title = printTitle.current;
        root.current?.replaceChildren(renderConversation(document, validated.conversation, validated.preferences));
        loaded.current = true;
        setStatus("Preparing diagrams and images for printing…");
        const diagrams = root.current ? await renderMermaidDiagrams(root.current, validated.preferences.pdfTheme) : { failed: 0 };
        const missingImages=await readyForPrinting(document);
        if (disposed) return;
        setAvailable(true);
        const notes=[diagrams.failed?`${diagrams.failed} diagram(s) retained as source`:"",missingImages?`${missingImages} image(s) shown as placeholders`:""].filter(Boolean);
        setStatus(notes.length?`Ready. ${notes.join("; ")}. Select Print / Save as PDF.`:"Ready. Select Print / Save as PDF, then choose Save as PDF in your browser.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unable to render the conversation safely.");
      }
    };
    window.addEventListener("message", onMessage);
    const announce = () => {
      if (!loaded.current && window.opener) {
        window.opener.postMessage({ type: PRINT_READY }, window.location.origin);
        announced = true;
      }
    };
    announce();
    const timer = window.setInterval(announce, 700);
    const timeout = window.setTimeout(() => {
      window.clearInterval(timer);
      if (!loaded.current && announced) setStatus("Unable to receive the conversation. Return to the inspector and open print preview again.");
    }, 20_000);
    return () => {
      disposed = true;
      window.removeEventListener("message", onMessage);
      window.clearInterval(timer);
      window.clearTimeout(timeout);
    };
  }, []);

  async function print() {
    if (!available || printing) return;
    setPrinting(true);
    setStatus("Preparing images and fonts for printing…");
    try {
      await readyForPrinting(document);
      // Next's initial metadata hydration may have restored the route title.
      // Set the conversation filename at the moment the print job is opened.
      document.title = printTitle.current;
      setStatus("Choose Save as PDF as the printer destination. The browser controls the final PDF filename.");
      window.print();
    } catch {
      setStatus("Some resources may be unavailable. You can still save the visible document as PDF.");
      window.print();
    } finally {
      setPrinting(false);
    }
  }

  return (
    <>
      <div className="print-toolbar" role="toolbar" aria-label="PDF print controls">
        <div>
          <strong>ChatGPT to PDF</strong>
          <span className="print-status" role="status" aria-live="polite"> · {status}</span>
        </div>
        <div className="print-toolbar-actions">
          <button onClick={() => window.close()} type="button">Close</button>
          <button className="primary" onClick={() => void print()} type="button" disabled={!available || printing}>
            {printing ? "Preparing…" : "Print / Save as PDF"}
          </button>
        </div>
      </div>
      <div id="print-root" ref={root} aria-label="Conversation print document" />
    </>
  );
}
