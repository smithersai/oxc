#!/usr/bin/env node
// Go's internal-package rule requires building within VibeLang's tsc module.
// The temporary command directory is removed even when compilation fails.
import { mkdtempSync, copyFileSync, rmSync, realpathSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
if (process.argv.length !== 4)
  throw new Error("usage: node build-preprocessor.mjs <vibelang-checkout> <output-binary>");
const source = realpathSync(process.argv[2]);
const out = resolve(process.argv[3]);
const temporary = mkdtempSync(join(source, "typescript/tsc/cmd/oxlint-hook-"));
try {
  copyFileSync(new URL("./compiler/main.go", import.meta.url), join(temporary, "main.go"));
  const result = spawnSync("go", ["build", "-o", out, "."], { cwd: temporary, stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 2;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
