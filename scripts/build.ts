// Bundles each extension entry point into a single classic script under extension/dist/.
// Content scripts are injected via executeScript and the popup loads a plain <script>,
// so every entry is emitted as an IIFE.
import { rm } from "node:fs/promises";

const root = new URL("../extension/", import.meta.url).pathname;
const entries = {
  background: "src/background/index.ts",
  content: "src/content/index.ts",
  popup: "src/popup/index.ts",
} as const;

async function build(): Promise<boolean> {
  await rm(`${root}dist`, { recursive: true, force: true });
  let ok = true;
  for (const [name, entry] of Object.entries(entries)) {
    const r = await Bun.build({
      entrypoints: [`${root}${entry}`],
      outdir: `${root}dist`,
      naming: `${name}.js`,
      target: "browser",
      format: "iife",
      minify: false,
    });
    if (!r.success) {
      ok = false;
      for (const log of r.logs) console.error(log);
    }
  }
  console.log(ok ? "built extension/dist" : "build failed");
  return ok;
}

if (!(await build())) process.exit(1);

if (process.argv.includes("--watch")) {
  const { watch } = await import("node:fs");
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(`${root}src`, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => void build(), 100);
  });
  console.log("watching extension/src ...");
}
