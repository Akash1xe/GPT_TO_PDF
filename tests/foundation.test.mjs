import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (relative) => readFileSync(path.join(root, relative), "utf8");

test("foundational Next.js App Router structure exists", () => {
  for (const file of [
    "src/app/layout.tsx", "src/app/page.tsx", "src/app/globals.css",
    "src/app/api/health/route.ts", "next.config.ts",
    "tsconfig.json", "postcss.config.mjs", "eslint.config.mjs",
    ".github/workflows/ci.yml",
  ]) assert.ok(existsSync(path.join(root, file)), file);
});

test("configuration is strict, uses Next.js App Router and Tailwind PostCSS", () => {
  const manifest = JSON.parse(read("package.json"));
  const tsconfig = JSON.parse(read("tsconfig.json"));
  assert.equal(manifest.private, true);
  assert.match(manifest.dependencies.next, /^16\./);
  assert.equal(manifest.scripts.build, "next build");
  assert.equal(tsconfig.compilerOptions.strict, true);
  assert.match(read("postcss.config.mjs"), /@tailwindcss\/postcss/);
  assert.match(read("src/app/globals.css"), /@import "tailwindcss";/);
});

test("the site clearly describes PDF print preview and its limited shared link support", () => {
  const home = read("src/app/page.tsx");
  assert.match(home, /Public shared-link import/);
  assert.match(home, /Import a public shared link or local ChatGPT files/);
  assert.match(home, /<ImportStudio \/>/);
  assert.match(home, /id="main-content"/);
  assert.match(read("src/app/layout.tsx"), /lang="en"/);
});

test("public health route is static and does not touch conversation data", () => {
  const route = read("src/app/api/health/route.ts");
  assert.match(route, /export function GET\(\)/);
  assert.match(route, /Cache-Control/);
  assert.doesNotMatch(route, /request\.json\(|process\.env|fetch\(/);
});

test("shared model, extraction, PDF and security boundaries are reserved", () => {
  for (const folder of ["conversation", "extractors", "pdf", "security"]) {
    assert.ok(existsSync(path.join(root, "src/lib", folder, "README.md")));
  }
});

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((ent) => {
    const full = path.join(dir, ent.name);
    return ent.isDirectory() ? walk(full) : [full];
  });
}

test("foundation source does not depend on browser extension APIs", () => {
  for (const file of walk(path.join(root, "src")).filter((name) => /\.(ts|tsx)$/.test(name))) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /\bchrome\.(?:tabs|runtime|storage)\b/, file);
  }
});

test("all local source imports resolve to a real file", () => {
  const candidatePaths = (name) => [name, name + ".ts", name + ".tsx", name + ".js", name + ".mjs", path.join(name, "index.tsx")];
  for (const file of walk(path.join(root, "src")).filter((name) => /\.(ts|tsx)$/.test(name))) {
    const code = readFileSync(file, "utf8");
    const imports = [...code.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((match) => match[1]);
    for (const spec of imports.filter((value) => value.startsWith("@/") || value.startsWith("."))) {
      const base = spec.startsWith("@/") ? path.join(root, "src", spec.slice(2)) : path.resolve(path.dirname(file), spec);
      assert.ok(candidatePaths(base).some(existsSync), `Unresolved ${spec} in ${path.relative(root, file)}`);
    }
  }
});
