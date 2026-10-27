import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon, CodeIcon, LayersIcon, LinkIcon, ShieldIcon, SparkIcon } from "@/components/icons";
import { ConversationPreview } from "@/components/conversation-preview";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SharedLinkLab } from "@/components/shared-link-lab";
import { ImportStudio } from "@/components/import-studio";
import { siteConfig } from "@/lib/site-config";

const capabilities = [
  {
    title: "Rich formatting",
    text: "Designed to preserve headings, links, lists, tables and readable code.",
    icon: LayersIcon,
  },
  {
    title: "Complex content",
    text: "Preserves supported math, images, SVG diagrams and visual elements in supplied content.",
    icon: CodeIcon,
  },
  {
    title: "Privacy by design",
    text: "Browser-local importing and rendering with no stored conversation history.",
    icon: ShieldIcon,
  },
];

const plannedSteps = [
  { label: "01", title: "Add your conversation", text: "Paste a public ChatGPT shared link, or import ZIP/JSON, HTML, Markdown or text." },
  { label: "02", title: "Preview every detail", text: "Review messages and choose fonts, margins and page theme." },
  { label: "03", title: "Print a beautiful PDF", text: "Save a structured, selectable-text document from your browser." },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section className="hero-wash relative overflow-hidden">
          <div className="pointer-events-none absolute -top-44 right-[-13rem] size-[620px] rounded-full bg-[#d9eedb]/55 blur-[110px]" aria-hidden="true" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-16 px-5 pb-28 pt-20 lg:grid-cols-[1.08fr_.92fr] lg:gap-10 lg:pb-32 lg:pt-28 sm:px-8">
            <div className="relative z-[1] max-w-[570px]">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#cfe7d3] bg-[#eff8ee] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[.11em] text-[#367752]">
                <span className="size-1.5 rounded-full bg-[#2ba56c]" aria-hidden="true" />
                PDF exports · release candidate
              </div>
              <h1 className="text-balance text-[clamp(2.9rem,5.2vw,4.5rem)] font-bold leading-[1.085] tracking-[-.065em] text-[#133a2c]">
                Your conversations deserve a <span className="relative whitespace-nowrap text-[#218152]">better home.</span>
              </h1>
              <p className="mt-7 max-w-[490px] text-[16px] leading-[1.9] text-[#667a6c] sm:text-[17px]">
                Paste a public ChatGPT shared link or import supported exports, Markdown and HTML to create readable, selectable-text PDFs in your browser.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a href="#inspector" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#174d36] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_-12px_#174d36] transition hover:bg-[#116242] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#17613f]">
                  Convert a shared link <ArrowRightIcon className="size-4" />
                </a>
                <a href={siteConfig.websiteRepository} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#d7e4d9] bg-white px-5 py-3 text-sm font-semibold text-[#31513e] transition hover:border-[#b5cdb8] hover:bg-[#fbfffb]">
                  Browse source <ArrowUpRightIcon className="size-4" />
                </a>
              </div>
              <p className="mt-5 flex items-center gap-2 text-[12px] text-[#829489]"><SparkIcon className="size-3.5 text-[#42a879]"/> Public shared-link import with browser capture and file import as fallbacks.</p>
              <div className="mt-11 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-[#5f7a69]">
                {["Structured text", "Math & diagrams", "Custom print themes"].map((item) => (
                  <span className="inline-flex items-center gap-2" key={item}><CheckIcon className="size-3.5 text-[#3e9969]"/>{item}</span>
                ))}
              </div>
            </div>
            <div className="relative z-[1] flex justify-center lg:justify-end">
              <ConversationPreview />
            </div>
          </div>
        </section>

        <SharedLinkLab />
        <ImportStudio />

        <section id="how-it-works" className="border-y border-[#e7eee7] bg-white py-20 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <div className="mb-11 max-w-[550px]">
              <span className="text-xs font-bold uppercase tracking-[.19em] text-[#30815a]">Built for the details</span>
              <h2 className="mt-4 text-[clamp(2rem,3.2vw,2.7rem)] font-bold tracking-[-.045em] text-[#1a392b]">More than a plain text export.</h2>
              <p className="mt-4 text-[15px] leading-7 text-[#7b8d80]">The website uses a semantic PDF engine adapted from our existing browser extension.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {capabilities.map(({title,text,icon:Icon}) => (
                <article key={title} className="rounded-2xl border border-[#e7ede6] bg-[#fdfefd] p-7 transition hover:border-[#c3ddcc] hover:shadow-[0_16px_32px_-25px_rgba(20,86,46,.3)]">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-[#eaf6ec] text-[#2c8154]"><Icon className="size-5"/></span>
                  <h3 className="mt-6 text-lg font-semibold tracking-tight text-[#214331]">{title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#738677]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="roadmap" className="bg-[#f7faf6] py-20 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div className="max-w-[610px]">
                <span className="text-xs font-bold uppercase tracking-[.19em] text-[#30815a]">How it works</span>
                <h2 className="mt-4 text-[clamp(2rem,3.2vw,2.7rem)] font-bold tracking-[-.045em] text-[#193a2c]">From a conversation to a keepsake.</h2>
                <p className="mt-4 text-[15px] leading-7 text-[#778c7d]">Import a public shared link or local ChatGPT files, then print using your browser.</p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#dce9df] bg-white px-3 py-2 text-xs font-semibold text-[#588465]"><span className="size-1.5 rounded-full bg-[#51ae76]"/> PDF import available</span>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {plannedSteps.map((step) => (
                <article key={step.label} className="rounded-2xl border border-[#e2eae1] bg-white p-7">
                  <div className="flex items-center justify-between">
                    <span className="text-[27px] font-bold tracking-[-.08em] text-[#bbd5c1]">{step.label}</span>
                    {step.label==="01" ? <LinkIcon className="size-5 text-[#63a780]"/> : step.label==="02" ? <LayersIcon className="size-5 text-[#63a780]"/> : <CheckIcon className="size-5 text-[#63a780]"/>}
                  </div>
                  <h3 className="mt-7 text-[17px] font-semibold text-[#244735]">{step.title}</h3>
                  <p className="mt-3 text-[13px] leading-6 text-[#7a8b7e]">{step.text}</p>
                </article>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#dcebdd] bg-[#ecf7ed] px-6 py-5">
              <div><p className="text-sm font-semibold text-[#2a6944]">PDF printing is available for supported imports</p><p className="mt-1 text-xs text-[#668975]">Rich printable pages from local HTML: code, math, images, diagrams, themes and page sizing.</p></div>
              <span className="inline-flex items-center gap-2 rounded-lg border border-[#c6e2cc] bg-white px-3 py-2 text-xs font-bold text-[#318050]"><CheckIcon className="size-4"/> PDF preview ready</span>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
