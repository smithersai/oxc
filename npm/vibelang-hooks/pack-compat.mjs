#!/usr/bin/env node
// Stage an installable compatibility release around an already built fork.
import { cpSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
const [built, version, output] = process.argv.slice(2);
if (!built || !/^\d+\.\d+\.\d+$/.test(version ?? "") || !output) {
  throw new Error("usage: pack-compat.mjs <built-fork-package> <exact-upstream-version> <output>");
}
const out = resolve(output);
const stage = join(out, "oxfmt-" + version);
mkdirSync(stage, { recursive: true });
cpSync(resolve(built), stage, { recursive: true });
const pkg = JSON.parse(readFileSync(join(stage, "package.json"), "utf8"));
pkg.name = "@smithersai/oxfmt";
pkg.version = version + "-vibe.2";
pkg.dependencies = { ...pkg.dependencies, "@smithersai/oxfmt-upstream": "npm:oxfmt@" + version };
delete pkg.optionalDependencies;
renameSync(join(stage, "dist/cli.js"), join(stage, "dist/vibe-cli.js"));
renameSync(join(stage, "dist/index.js"), join(stage, "dist/vibe-index.js"));
for (const [source, destination] of [
  ["compat-cli.mjs", "cli.js"],
  ["compat-api.mjs", "index.js"],
]) {
  cpSync(new URL(source, import.meta.url), join(stage, "dist", destination));
}
writeFileSync(join(stage, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
const result = spawnSync("npm", ["pack", "--pack-destination", out], {
  cwd: stage,
  stdio: "inherit",
});
if (result.error || result.status !== 0) throw result.error ?? new Error("npm pack failed");
