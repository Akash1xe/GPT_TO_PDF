# System-design PDF comparison and fixes

Compared the owner's `Extension.pdf` reference with the website's `Learn System Design.pdf` on October 27, 2026. The reference had eight A4 pages and five illustrations. The earlier website file had four pages, no illustrations, unformatted LaTeX, a source-code flowchart, and flattened or missing quiz/progress content. Both used approximately 8 pt body text; shrinking or enlarging the body font was not the remedy.

## Root cause

The restricted rendering-metadata reader did not understand safe data operations used in these lessons: constant arrays/objects, conditional quiz feedback, array mapping/filtering, static state lookups, simple arithmetic and string interpolation. Encountering these expressions caused the entire assistant answer to use its Markdown alternative. That alternative omitted the resolved image components and interactive state, and the Markdown importer did not recognize LaTeX delimiters. A diagram stored as a client-defined `<CodeBlock language="mermaid">` widget also needed its source recovered from the supplied component range.

## Changes

- Read only whitelisted data operations over serialized default state. Do not invoke imported JavaScript, getters, event handlers, network functions, or constructors. Maintain depth, iteration and work limits.
- Recover the five resolved public illustrations and their clickable attribution links. Keep image loading opt-in, with a prominent **Preview PDF with 5 online images** action for this conversation.
- Preserve the selected quiz answer and its feedback, all mapped quiz options, five chapter checkboxes, the chapter progress bar, and three contribution bars as static printable content.
- Preserve grid cards and native math components. Recognize `\(...\)`, `\[...\]`, `$...$` and `$$...$$` in Markdown alternatives while leaving code fences/spans and ordinary currency intact.
- Recover the source of the client-defined Mermaid widget and use the existing vector renderer. Cap tall diagrams at 190 mm to leave useful space for accompanying text.
- Wait for images/fonts before enabling printing. Failed or timed-out pictures become labeled placeholders; they do not silently produce blank image elements.
- Remove trailing spacing after the final message so a nearly full final page does not create an empty extra page.

## Verification

The actual supplied public share imports successfully through the running API. The corrected print document contains four messages, five loaded illustrations, five math expressions, one rendered flowchart, five checkboxes, 13 radio options and four progress bars, with no image placeholders.

The regenerated dark PDF has **eight pages**, five embedded raster illustrations, typeset mathematical expressions, selectable diagram labels, source links and preserved quiz/progress state. All pages were rendered and inspected; text-boundary checks found no overflow and no blank trailing page. The two original PDFs were not modified.

Validation passed: 152 unit tests, 21 browser tests, TypeScript, ESLint and the production build. New synthetic regression fixtures cover these lesson patterns without committing the owner's conversation data. Browser coverage includes the explicit image opt-in, complete lesson rendering, diagram/math PDF text, grid positioning, and the final-page spacing boundary.

Refresh the website and import the shared conversation again. Choose the image-inclusive preview action to reproduce the illustrated output; the ordinary image-disabled path intentionally retains placeholders.
