import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.env.FOLDKIT_ROOT;
test(
  "installed packages: foldkit scripts discover and reject seeded .vibe violations",
  { skip: !root },
  () => {
    const file = "packages/foldkit/src/oxcForkProbe.vibe";
    const path = resolve(root, file);
    assert.equal(existsSync(path), false, "refuse to overwrite an existing file");
    const logs = resolve(process.env.OXC_VIBE_TEST_LOGS ?? "target/vibe-foldkit");
    mkdirSync(logs, { recursive: true });
    const run = (name, args) => {
      const result = spawnSync("pnpm", args, {
        cwd: root,
        env: { ...process.env, CI: "true", HUSKY: "0" },
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
      assert.ifError(result.error);
      const output = result.stdout + result.stderr;
      writeFileSync(join(logs, name + ".log"), output);
      return { ...result, output };
    };
    writeFileSync(path, "export const oxcForkProbe: any    =    { a:1,b:2 };\n");
    try {
      const lint = run("lint", [
        "exec",
        "oxlint",
        "--disable-nested-config",
        "--format",
        "json",
        file,
      ]);
      assert.equal(lint.status, 1, lint.output);
      const diagnostics = JSON.parse(lint.stdout).diagnostics;
      assert.ok(
        diagnostics.some((d) => JSON.stringify(d).includes("no-explicit-any")),
        lint.output,
      );
      const scripts = run("lint-script", ["run", "lint:ci"]);
      assert.notEqual(scripts.status, 0, scripts.output);
      assert.match(scripts.output, /oxcForkProbe\.vibe/);
      const check = run("format-seed", ["run", "format:check"]);
      assert.equal(check.status, 1, check.output);
      assert.match(check.output, /oxcForkProbe\.vibe/);
      assert.equal(
        readFileSync(path, "utf8"),
        "export const oxcForkProbe: any    =    { a:1,b:2 };\n",
      );
      const write = run("format-write", ["run", "format", file]);
      assert.equal(write.status, 0, write.output);
      assert.equal(readFileSync(path, "utf8"), "export const oxcForkProbe: any = { a: 1, b: 2 }\n");
      const clean = run("format-clean", ["run", "format:check", file]);
      assert.equal(clean.status, 0, clean.output);
    } finally {
      rmSync(path, { force: true });
    }
  },
);
