# Shared-link conversion fix

The original website never attempted to retrieve shared conversations: its API returned `retrieval: "disabled"` and `conversionReady: false` for every valid URL. Its HTML parser also ignored the embedded React Router data containing modern shared conversations. Existing PDF rendering worked only after local import.

The shared-link form now explicitly sends `retrieve: true` to `/api/shared-link/inspect`. The server validates and canonicalizes the URL, requests only `https://chatgpt.com/share/<uuid>`, and decodes embedded indexed JSON without evaluating scripts. Legacy `__NEXT_DATA__` and role-marked HTML are also supported. The active conversation branch passes through the existing Markdown importer, validation, PDF settings, and print renderer.

Hidden messages, tool-directed assistant calls, and reasoning metadata are excluded. This also corrects JSON export imports. PDF generation still uses the browser's **Save as PDF** dialog; it is not a binary PDF download endpoint.

Retrieval has a 15-second timeout and a 2 MB streamed byte limit, sends no authentication or cookies, follows no redirects, and disables caching. Deleted, blocked, restricted, oversized, or unsupported shares show a controlled error and the existing browser capture/file import alternatives. The application does not persist retrieved chats. Hosting infrastructure may retain request metadata.

Tested live against the supplied share on October 27, 2026: **Project Name Suggestions**, 36 visible messages (17 user, 19 assistant), 6 code blocks. This verifies that sample at test time; ChatGPT response formats and server accessibility can change. Media bytes and alternate branches are not guaranteed.

Regression coverage includes modern indexed streams, legacy JSON, static HTML, active branch selection, hidden/tool filtering, fetch restrictions and failures, API integration, and the website's shared-link-to-print flow. Browser tests use deterministic responses so CI does not depend on live ChatGPT availability.
