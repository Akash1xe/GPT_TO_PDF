import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto flex min-h-[65vh] max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-sm font-bold uppercase tracking-[.22em] text-[#45845b]">404</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-[#173a2b]">Page not found</h1>
        <p className="mt-4 max-w-md leading-7 text-[#668174]">This page doesn&apos;t exist. You can head back to the project homepage.</p>
        <Link href="/" className="mt-8 rounded-xl bg-[#174d36] px-5 py-3 font-semibold text-white transition hover:bg-[#116242]">Return home</Link>
      </main>
      <SiteFooter />
    </>
  );
}
