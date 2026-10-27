/**
 * Browser-side capture helper for user-opened ChatGPT share pages.
 *
 * This runs only when the user activates the bookmarklet on chatgpt.com.
 * It does not fetch remote content, read cookies, or contact our servers.
 * The copied DOM snapshot is fed to the website's existing inert HTML parser.
 */
export const CHATGPT_CAPTURE_BOOKMARKLET = `javascript:(async function(){
  try {
    if (location.hostname !== "chatgpt.com" || !/^\\/share\\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\\/?$/i.test(location.pathname)) {
      throw new Error("Open a ChatGPT shared conversation (/share/...) first.");
    }
    const root = document.querySelector("main") || document.querySelector("[role=main]") || document.body;
    if (!root) throw new Error("The shared conversation has not loaded.");
    const clone = root.cloneNode(true);
    clone.querySelectorAll("script,style,noscript,template,iframe,form,button,input,textarea,select,nav,aside,footer").forEach(node => node.remove());
    const markers = clone.querySelectorAll('[data-message-author-role="user"],[data-message-author-role="assistant"],[data-user-message-bubble],[data-conversation-role="user"],[data-conversation-role="assistant"],[data-role="user"],[data-role="assistant"]');
    if (!markers.length) throw new Error("No visible conversation message markers found. Let the conversation finish loading, then try again.");
    const safeTitle = document.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = "<!doctype html><html><head><title>" + safeTitle + "</title><meta name='chatpdf-capture-source' content='" + location.origin + location.pathname + "'></head><body>" + clone.outerHTML + "</body></html>";
    if (html.length > 2000000) throw new Error("The captured page exceeds 2 MB. Use the extension or a file export for a very long conversation.");
    if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("Clipboard writing is unavailable in this browser.");
    await navigator.clipboard.writeText(html);
    alert("Copied " + markers.length + " message markers. Return to your PDF website and click Import captured conversation. The snapshot may be partial if ChatGPT has not mounted every message.");
  } catch (error) {
    alert("ChatGPT capture: " + (error && error.message ? error.message : String(error)));
  }
})()`;

/** Clear instructions for browsers that prevent direct clipboard reading. */
export const CAPTURE_HELP =
  "If clipboard access is denied, paste the captured HTML in Advanced: extract from a saved HTML sample.";
