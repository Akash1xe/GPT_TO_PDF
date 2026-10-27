import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { importPastedContent } from "../src/lib/import/pasted-content.ts";
import { preparePrintPayload } from "../src/lib/pdf/print-job.ts";
import { controlExternalImages } from "../src/lib/pdf/external-media.ts";
import { parseConversationData } from "../src/lib/conversation/validation.ts";

const read = (path) => readFileSync(fileURLToPath(new URL("../"+path,import.meta.url)),"utf8");

const withMedia = () => importPastedContent(
 '<article data-role="assistant"><section style="border:1px solid #ddd">'
 + '<p>Private visual report</p>'
 + '<img src="https://example.net/private.png" alt="Chart" width="350" height="200">'
 + '<img src="data:image/png;base64,aGVsbG8=" alt="Embedded raster" width="120" height="80">'
 + '</section></article>',"html").conversation;

test("Vercel configuration uses Next.js and leaves defaults intact",()=>{
 const config=JSON.parse(read("vercel.json"));
 assert.equal(config.framework,"nextjs");
 assert.equal(config.buildCommand,undefined);
 assert.equal(config.outputDirectory,undefined);
 assert.equal(config.installCommand,undefined);
 assert.equal(JSON.parse(read("package.json")).scripts.build,"next build");
 assert.match(read("next.config.ts"),/no-store/);
});

test("default PDF import strips external images but keeps embedded data and caption structure",()=>{
 const convo=withMedia();
 const payload=preparePrintPayload(convo,{});
 assert.equal(payload.allowExternalImages,false);
 const layout=payload.conversation.messages[0].blocks[0];
 assert.equal(layout.type,"layout");
 const remote=layout.blocks.find(block=>block.type==="image" && /Chart/.test(block.alt));
 const local=layout.blocks.find(block=>block.type==="image" && /Embedded raster/.test(block.alt));
 assert.equal(remote.src,undefined);
 assert.equal(remote.sourceType,"unknown");
 assert.match(remote.alt,/external image not loaded/);
 assert.match(local.src,/^data:image\/png;base64,/);
 assert.equal(parseConversationData(payload.conversation).ok,true);
 assert.match(JSON.stringify(convo),/https:\/\/example.net\/private.png/);
});

test("explicit consent permits valid remote media without weakening source validation",()=>{
 const convo=withMedia();
 const payload=preparePrintPayload(convo,{},true);
 assert.equal(payload.allowExternalImages,true);
 assert.match(JSON.stringify(payload.conversation),/https:\/\/example.net\/private.png/);
 assert.equal(parseConversationData(payload.conversation).ok,true);
 assert.deepEqual(controlExternalImages(convo,true),convo);
});

test("nested external image suppression is stable and does not mutate source data",()=>{
 const convo=withMedia();
 const filtered=controlExternalImages(convo,false);
 const again=controlExternalImages(filtered,false);
 assert.deepEqual(again,filtered);
 assert.notDeepEqual(filtered,convo);
 const message=filtered.messages[0];
 assert.ok(message.blocks[0].blocks.find(block=>block.type==="image"&&block.src===undefined));
 assert.equal(parseConversationData(filtered).ok,true);
});

test("privacy text, noindex and response protections remain visible for controlled testing",()=>{
 assert.match(read("src/app/layout.tsx"),/index: false/);
 assert.match(read("src/app/privacy/page.tsx"),/browser/);
 assert.match(read("src/components/site-footer.tsx"),/href="\/privacy"/);
 assert.match(read("src/components/pdf-export-controls.tsx"),/Load external images/);
 assert.match(read("src/components/import-studio.tsx"),/2_000_000/);
 assert.match(read("src/components/shared-link-lab.tsx"),/2_000_000/);
 assert.match(read("docs/VERCEL_RELEASE.md"),/No deployment is performed/);
 assert.match(read(".gitignore"),/\.env\*/);
});
