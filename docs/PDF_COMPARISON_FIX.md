# Extension / website PDF comparison

Compared the owner's two exports of **Project Name Suggestions** on October 27, 2026. The originals were read without modification. The extension PDF has 11 pages; the earlier website PDF has 10. Both use A4 and approximately 8 pt body text, so the principal defects were content reconstruction and CSS rather than the base font size. The original document title is intact when rendered at sufficient resolution.

## Findings and fixes

| Observed website problem | Change |
| --- | --- |
| Raw `<box>`, `<row>`, `<text>`, `<Link>`, `<Cite>`, callback expressions, and state declarations appear as prose or accidental code blocks | Read the message's declarative rendering metadata through an AST parser. Reconstruct a restricted, static semantic tree; no conversation JavaScript, hooks, event handlers, or constructors are executed. Unsupported syntax uses the supplied Markdown alternative. |
| Numbered steps and bullets are missing | Restore list styles explicitly in the print stylesheet. The website's Tailwind reset had removed the browser markers. |
| Rich cards, keyboard hints, links, radio options and visual groupings are lost | Convert supported primitives into the existing validated layout, control, link, table, code, and image blocks. Event handlers stay inactive. |
| Internal citation IDs leak into the PDF | Resolve supplied search-result IDs to labeled URLs. Internal turn identifiers are never printed as citations. |
| Extra assistant progress text precedes final responses | Omit thinking preambles when their turn already contains a visible final answer. Keep ordinary commentary when there is no replacement. |
| An empty assistant answer disappears along with its generated image | Retain the image-only reply at its original position with an explicit unavailable-image placeholder when the share provides only an internal file reference. |
| Both images are absent | Recover the publicly resolved illustration from component metadata and respect its source size limit. External images remain opt-in. The generated image has an authenticated file reference; it is labeled rather than silently dropped. |
| Chrome suggests the generic print-route filename | Restore the conversation title immediately before opening the print dialog; initial Next metadata hydration had overwritten the earlier assignment. |

## Verification

The repaired import contains **34 messages: 17 user and 17 assistant**, one real code block, and two image blocks (one public illustration and one explicit missing-asset placeholder). The earlier importer produced 36 messages and six code blocks, including progress entries and accidentally interpreted UI source.

An 11-page dark PDF was regenerated from the supplied public share using the actual website UI, with external images enabled. Every page was rendered for visual inspection. The public illustration loaded, list markers and readable content were preserved, and raw UI/callback markup was absent. The original generated picture is not falsely presented as recovered.

Regression tests cover static UI reconstruction, links, tables, controls, exact code strings, citation resolution, image metadata, image-only replies, and suppression of replaced progress messages. The browser regression checks actual list-marker CSS, the conversation filename at print time, and generated PDF output.

## Remaining source limitation

The generated infographic is visible in the original ChatGPT tab, but its share payload supplies `sediment://...` rather than image bytes. A credential-free request to ChatGPT's file-download endpoint returned HTTP 401. The website does not request login cookies or bypass that access check. Importing a browser capture with a usable image URL/embedded image, or an HTML snapshot with image data, is required to retain that asset. Remote-image opt-in alone cannot resolve an internal file pointer.

Refresh the importer and import the shared link again after updating. An already-open print tab contains the previous in-memory conversation and will not acquire the repaired data automatically.
