#!/usr/bin/env node
// Use VibeLang's formatter API when available, or its shipped dprint plugin.
import { createRequire } from "node:module";
import { dirname, resolve, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { readFileSync, mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

try {
  if (process.argv.length !== 3)
    throw new Error("usage: vibelang-oxfmt <file.vibe> (source on stdin)");
  const path = resolve(process.argv[2]);
  const require = createRequire(path);
  const source = readFileSync(0, "utf8");
  let api;
  try {
    api = require.resolve("vibelang/format");
  } catch (error) {
    if (error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED" && error.code !== "MODULE_NOT_FOUND")
      throw error;
  }
  if (api) {
    const { formatSource } = await import(pathToFileURL(api).href);
    process.stdout.write(await formatSource(source, path));
  } else {
    let plugin = join(dirname(require.resolve("vibelang/package.json")), "dprint-plugin.json");
    const descriptor = JSON.parse(readFileSync(plugin, "utf8"));
    const platform = process.platform === "linux" && process.arch === "x64" ? "linux-x86_64" : "";
    if (
      platform &&
      descriptor[platform]?.reference &&
      !/^[a-z]+:/i.test(descriptor[platform].reference) &&
      !existsSync(resolve(dirname(plugin), descriptor[platform].reference))
    ) {
      plugin = fileURLToPath(new URL("./dprint-plugin.json", import.meta.url));
    }
    const checksum = createHash("sha256").update(readFileSync(plugin)).digest("hex");
    const dir = mkdtempSync(join(tmpdir(), "oxfmt-vibe-"));
    try {
      const config = join(dir, "dprint.json");
      writeFileSync(
        config,
        JSON.stringify({
          plugins: [
            "https://plugins.dprint.dev/typescript-0.93.4.wasm@cdbf74066391bdb11ddaef9ea95299636a97d637f5a9bf7f121d584875647c7a",
            plugin + "@" + checksum,
          ],
          typescript: { semiColons: "asi", quoteStyle: "alwaysDouble" },
        }),
      );
      const localRequire = createRequire(import.meta.url);
      const result = spawnSync(
        process.execPath,
        [localRequire.resolve("dprint/bin.cjs"), "fmt", "--config", config, "--stdin", path],
        { input: source, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      );
      if (result.error || result.status !== 0)
        throw new Error(result.error?.message ?? result.stderr + result.stdout);
      process.stdout.write(result.stdout);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
