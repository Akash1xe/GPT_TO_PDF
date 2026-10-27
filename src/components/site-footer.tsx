import Link from "next/link";
import { FileIcon } from "@/components/icons";
import { siteConfig } from "@/lib/site-config";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#e4eae5] bg-[#f8faf7]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-2.5 text-sm font-semibold text-[#204535]">
          <FileIcon className="size-4" /> {siteConfig.name}
          <span className="ml-2 font-normal text-[#7b887e]">Independent project, not affiliated with OpenAI.</span>
        </div>
        <div className="flex items-center gap-5 text-xs text-[#64796c]">
          <a href={siteConfig.extensionRepository} target="_blank" rel="noopener noreferrer" className="hover:text-[#11472d]">Original extension</a>
          <Link href="/privacy" className="hover:text-[#11472d]">Privacy</Link>
          <Link href="/api/health" className="hover:text-[#11472d]">API status</Link>
          <span>Release candidate</span>
        </div>
      </div>
    </footer>
  );
}
