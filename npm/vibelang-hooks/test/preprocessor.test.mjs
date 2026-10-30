import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Builds vibelang-oxlint against the VibeLang checkout in VIBELANG_CHECKOUT.
const checkout = process.env.VIBELANG_CHECKOUT;
test(
  "vibelang-oxlint lints a file whose forms only the project's types decide",
  { skip: !checkout && "set VIBELANG_CHECKOUT to a VibeLang checkout" },
  () => {
    const dir = mkdtempSync(join(tmpdir(), "vibelang-oxlint-"));
    try {
      const hook = join(dir, "vibelang-oxlint");
      const build = spawnSync(
        process.execPath,
        [fileURLToPath(new URL("../build-preprocessor.mjs", import.meta.url)), checkout, hook],
        { encoding: "utf8" },
      );
      assert.equal(build.status, 0, build.stdout + build.stderr);
      const project = (source) => {
        const file = join(dir, "main.vibe");
        writeFileSync(file, source);
        return spawnSync(hook, [file], { input: source, encoding: "utf8" });
      };
      // EK9101: which module's match this is depends on input's type.
      const source = "export const g = (input: unknown) => input.match({ onNone: () => 1, onSome: () => 2 })\n";
      const typed = project(source);
      assert.equal(typed.status, 0, typed.stderr);
      const output = JSON.parse(typed.stdout);
      assert.match(output.code, /input\.match/);
      assert.ok(output.segments.length > 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
