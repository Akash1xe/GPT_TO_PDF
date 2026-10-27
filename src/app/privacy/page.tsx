import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy and limitations",
  description: "How Chat to PDF processes imported conversations locally and when external requests may occur.",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-6 py-16 text-[#224334]">
      <p className="text-xs font-bold uppercase tracking-[.15em] text-[#38805a]">Privacy</p>
      <h1 className="mt-4 text-4xl font-bold">How your conversations are processed</h1>
      <p className="mt-6 leading-7">Files and pasted content are processed in the browser. The application does not upload conversation contents to its own server, store chat histories in a database, or create downloadable server-side files. Printing uses your browser’s Save as PDF dialog.</p>
      <h2 className="mt-8 text-xl font-semibold">When network requests happen</h2>
      <p className="mt-3 leading-7">Opening the website loads its code and assets from its hosting provider. Converting a shared link sends its URL to this website’s server, which retrieves the public ChatGPT page and returns the extracted conversation to your browser. Content is processed transiently in server memory; the application does not save it to a database or file. Requests never include your ChatGPT login or cookies. Browser and hosting-provider infrastructure may keep standard request metadata logs.</p>
      <p className="mt-3 leading-7">External image loading in the PDF preview is <strong>off by default</strong>. You can explicitly enable it, but then your browser may contact image-hosting sites and share your IP address. Embedded image data and sanitized inline SVGs do not require those external requests.</p>
      <h2 className="mt-8 text-xl font-semibold">Completeness and supported sources</h2>
      <p className="mt-3 leading-7">ChatGPT ZIP/JSON exports, HTML snapshots, Markdown and text files can be imported. Some export formats omit original media pixels, computed styles, or alternate replies. Public shared links can be retrieved when ChatGPT permits access. Restricted, deleted, blocked or unsupported shares require browser capture or file import. Any incomplete import is labeled as possibly partial.</p>
      <h2 className="mt-8 text-xl font-semibold">Control and safety</h2>
      <p className="mt-3 leading-7">Close the tab to discard its in-memory imported conversation. We do not promise that other browser extensions, installed software, print destinations or the websites hosting images will respect the same privacy controls. Do not upload chat exports to services you do not trust.</p>
      <p className="mt-8"><Link href="/" className="font-semibold text-[#167044] underline">Return to Chat to PDF</Link></p>
    </main>
  );
}
