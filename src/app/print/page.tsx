import type { Metadata } from "next";
import { PrintDocumentClient } from "@/components/print-document-client";

export const metadata: Metadata = {
  title: "PDF Print Preview",
  robots: { index: false, follow: false },
};

export default function PrintPage() {
  return <PrintDocumentClient />;
}
