#!/usr/bin/env node
// Pack already-built Linux x64 artifacts. No publishing or VCS side effects.
import { cpSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("../../", import.meta.url));
if (process.argv.length !== 5)
  throw new Error("usage: pack.mjs <preprocessor-binary> <vibelang-package> <output-dir>");
const out = resolve(process.argv[4]);
mkdirSync(out, { recursive: true });
for (const tool of ["oxlint", "oxfmt", "oxc-vibelang-hooks"]) {
  const hooks = tool === "oxc-vibelang-hooks";
  const source = join(root, "npm", hooks ? "vibelang-hooks" : tool);
  const stage = join(out, tool);
  mkdirSync(stage, { recursive: true });
  const pkg = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
  pkg.name = "@smithersai/" + tool;
  pkg.version = hooks ? pkg.version : pkg.version + "-vibe.1";
  delete pkg.private;
  delete pkg.optionalDependencies;
  delete pkg.napi;
  pkg.os = ["linux"];
  pkg.cpu = ["x64"];
  pkg.libc = ["glibc"];
  pkg.repository = { type: "git", url: "https://github.com/smithersai/oxc" };
  if (hooks) {
    for (const name of [
      "format.mjs",
      "build-preprocessor.mjs",
      "compiler",
      "README.md",
      "INSTALL.md",
    ])
      cpSync(join(source, name), join(stage, name), { recursive: true });
    const compilerPackage = resolve(process.argv[3]);
    const descriptor = JSON.parse(
      readFileSync(join(compilerPackage, "dprint-plugin.json"), "utf8"),
    );
    const pluginArchive = descriptor["linux-x86_64"].reference;
    for (const [path, name] of [
      [join(compilerPackage, "../../LICENSE"), "VIBELANG-LICENSE"],
      [join(compilerPackage, "../../typescript/tsc/LICENSE"), "TYPESCRIPT-GO-LICENSE"],
      [join(compilerPackage, "../../typescript/NOTICE.txt"), "TYPESCRIPT-NOTICE"],
    ]) {
      cpSync(path, join(stage, name));
      pkg.files.push(name);
    }
    mkdirSync(join(stage, "native"), { recursive: true });
    cpSync(
      join(compilerPackage, pluginArchive),
      join(stage, "native/dprint-plugin-vibelang-linux-x86_64.zip"),
    );
    descriptor["linux-x86_64"].reference = "native/dprint-plugin-vibelang-linux-x86_64.zip";
    writeFileSync(join(stage, "dprint-plugin.json"), JSON.stringify(descriptor, null, 2));
    pkg.files.push("dprint-plugin.json", "native");
    mkdirSync(join(stage, "bin"), { recursive: true });
    cpSync(resolve(process.argv[2]), join(stage, "bin/vibelang-oxlint"));
    chmodSync(join(stage, "format.mjs"), 0o755);
    chmodSync(join(stage, "bin/vibelang-oxlint"), 0o755);
  } else {
    cpSync(join(root, "apps", tool, "dist"), join(stage, "dist"), { recursive: true });
    cpSync(join(source, "bin"), join(stage, "bin"), { recursive: true });
    cpSync(join(source, "configuration_schema.json"), join(stage, "configuration_schema.json"));
    cpSync(join(root, "LICENSE"), join(stage, "LICENSE"));
    cpSync(join(root, "THIRD-PARTY-LICENSE"), join(stage, "THIRD-PARTY-LICENSE"));
    pkg.files.push("LICENSE", "THIRD-PARTY-LICENSE");
  }
  writeFileSync(join(stage, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  const result = spawnSync("npm", ["pack", "--pack-destination", out], {
    cwd: stage,
    stdio: "inherit",
  });
  if (result.error || result.status !== 0) throw result.error ?? new Error("npm pack failed");
}

// Produce version-isolated packages for the migration pins. The 0.75 package
// above is only the native hook engine used as input, not a repo replacement.
for (const version of ["0.74.0", "0.66.0"]) {
  const result = spawnSync(
    process.execPath,
    [new URL("./pack-compat.mjs", import.meta.url).pathname, join(out, "oxfmt"), version, out],
    { stdio: "inherit" },
  );
  if (result.error || result.status !== 0) throw result.error ?? new Error("compat pack failed");
}
