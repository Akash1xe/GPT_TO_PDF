import { CheckIcon, CodeIcon, FileIcon } from "@/components/icons";

/**
 * Static visual example only. This does not request or convert a conversation.
 * When the renderer lands later, replace this mock with the real preview.
 */
export function ConversationPreview() {
  return (
    <div className="relative w-full max-w-[480px]">
      <div className="absolute -inset-6 rounded-[42px] bg-[#cde6d1]/40 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[22px] border border-[#e4e9e4] bg-white shadow-[0_24px_80px_-26px_rgba(26,63,45,.28)]">
        <div className="flex items-center justify-between border-b border-[#edf0ec] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#e9f4eb] text-[#245b3e]"><FileIcon className="size-4" /></div>
            <div><p className="text-[12px] font-bold text-[#22382c]">Conversation preview</p><p className="text-[10px] text-[#8a998f]">Illustrative example</p></div>
          </div>
          <span className="rounded-md border border-[#e3e9e4] bg-[#f6f8f6] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[#738378]">A4 · LIGHT</span>
        </div>
        <div className="space-y-5 px-6 py-6">
          <div className="border-b border-[#e8eee8] pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#8a9b8f]">CHATGPT CONVERSATION</p>
            <h3 className="mt-1.5 text-[21px] font-bold tracking-tight text-[#1c3528]">Understanding algorithms</h3>
            <p className="mt-1 text-[10px] text-[#97a39b]">Structured document preview</p>
          </div>
          <div className="border-l-[3px] border-[#c6d5cc] pl-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a9b8d]">You</p>
            <p className="mt-1.5 text-[12px] leading-5 text-[#3e5546]">Can you explain binary search simply?</p>
          </div>
          <div className="pl-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a9b8d]">Assistant</p>
            <p className="mt-2 text-[13px] font-bold text-[#1b3327]">Binary search</p>
            <p className="mt-1 text-[12px] leading-[1.75] text-[#506658]">A fast way to find an item in a <strong>sorted list</strong> by checking the middle.</p>
            <div className="mt-3 overflow-hidden rounded-lg bg-[#172b26]">
              <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2 text-[10px] text-[#9cbca8]">
                <span className="flex items-center gap-1.5"><CodeIcon className="size-3.5"/> Python</span>
                <span>Code block</span>
              </div>
              <pre className="overflow-x-auto px-3.5 py-3.5 font-mono text-[11px] leading-[1.75] text-[#e3efe7]"><code><span className="text-[#79d7ae]">while</span> low &lt;= high:{"\n"}  mid = (low + high) // 2{"\n"}  <span className="text-[#79d7ae]">if</span> arr[mid] == target:{"\n"}    <span className="text-[#b7dda5]">return</span> mid</code></pre>
            </div>
            <div className="mt-4 rounded-lg border border-[#e1e9e2] bg-[#f5faf5] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#63906f]">Time complexity</p>
              <p className="mt-1 text-[18px] font-semibold italic text-[#245439]">O(log n)</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[#edf0ed] bg-[#fbfdfb] px-5 py-3.5">
          <span className="flex items-center gap-1.5 text-[11px] text-[#72887a]"><CheckIcon className="size-3.5 text-[#25865b]"/> Readable layout</span>
          <span className="text-[10px] text-[#a2aaa4]">01 / 03</span>
        </div>
      </div>
      <div className="absolute -bottom-5 -right-3 flex items-center gap-2.5 rounded-xl border border-[#d8e7db] bg-white px-4 py-3 shadow-[0_12px_30px_-15px_rgba(12,63,31,.35)] sm:-right-8">
        <span className="flex size-8 items-center justify-center rounded-lg bg-[#daf4e4] text-[#1e8050]"><CheckIcon className="size-4"/></span>
        <div><p className="text-[11px] font-bold text-[#284b37]">Made for readable PDFs</p><p className="text-[10px] text-[#8b9b8f]">Renderer integration is next</p></div>
      </div>
    </div>
  );
}
