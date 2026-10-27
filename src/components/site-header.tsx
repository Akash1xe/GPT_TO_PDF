import Link from "next/link";
import { ArrowUpRightIcon, FileIcon } from "@/components/icons";
import { siteConfig } from "@/lib/site-config";

export function SiteHeader() {
  return (
    <header className="relative z-10 border-b border-[#e6eae6] bg-white/85 backdrop-blur-lg">
      <div className="mx-auto flex h-[76px] w-full max-w-6xl items-center justify-between gap-5 px-5 sm:px-8">
        <Link href="/" className="group inline-flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600" aria-label="Chat to PDF home">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#113b2f] text-white transition-transform group-hover:-rotate-3">
            <FileIcon className="size-5" />
          </span>
          <span className="text-[17px] font-bold tracking-tight text-[#112a24]">{siteConfig.name}</span>
          <span className="hidden rounded-md border border-[#dce9de] bg-[#f1f9f1] px-2 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#397453] sm:inline-flex">Web</span>
        </Link>
        <nav className="flex items-center gap-5 text-[13px] font-medium text-[#66756f] sm:gap-8" aria-label="Main navigation">
          <Link href="/#how-it-works" className="transition hover:text-[#153d31]">How it works</Link>
          <Link href="/#roadmap" className="hidden transition hover:text-[#153d31] sm:inline">Roadmap</Link>
          <a href={siteConfig.websiteRepository} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#d9e3dc] bg-white px-3.5 py-2.5 font-semibold text-[#1c4133] transition hover:border-[#9bc4ab] hover:bg-[#f8fbf8]">
            GitHub <ArrowUpRightIcon className="size-3.5" />
          </a>
        </nav>
      </div>
    </header>
  );
}
