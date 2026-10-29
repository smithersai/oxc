import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
const binary = process.env.OXFMT_COMPAT;
const reference = process.env.OXFMT_UPSTREAM;
test(
  "compat CLI isolates mixed targets, stdin, ignores and error exits",
  { skip: !binary || !reference },
  async () => {
    const { format } = await import(pathToFileURL(resolve(reference)));
    const cwd = mkdtempSync(join(tmpdir(), "oxfmt-compat-test-"));
    const run = (args, input) => {
      const result = spawnSync(process.execPath, [resolve(binary), ...args], {
        cwd,
        input,
        encoding: "utf8",
        env: { ...process.env, OXFMT_VIBE_FORMATTER: join(cwd, "formatter.mjs") },
      });
      assert.ifError(result.error);
      return { ...result, output: result.stdout + result.stderr };
    };
    try {
      mkdirSync(join(cwd, "nested"));
      const source = "export const fn = (a: number): number => a > 1 ? a : 0;\n";
      writeFileSync(join(cwd, "nested/a.ts"), source);
      writeFileSync(join(cwd, "nested/b.vibe"), "export  const b = 1\n");
      writeFileSync(
        join(cwd, "formatter.mjs"),
        '#!/usr/bin/env node\nimport {readFileSync} from "node:fs"; process.stdout.write(readFileSync(0,"utf8").replace(/ {2,}/g," "));\n',
        { mode: 0o755 },
      );
      const expected = (await format(join(cwd, "nested/a.ts"), source)).code;
      let result = run(["--check", "nested"]);
      assert.equal(result.status, 1, result.output);
      result = run(["nested"]);
      assert.equal(result.status, 0, result.output);
      assert.equal(readFileSync(join(cwd, "nested/a.ts"), "utf8"), expected);
      assert.equal(readFileSync(join(cwd, "nested/b.vibe"), "utf8"), "export const b = 1\n");
      result = run(["--check", "nested"]);
      assert.equal(result.status, 0, result.output);
      result = run(["--stdin-filepath", "nested/a.ts"], source);
      assert.equal(result.status, 0, result.output);
      assert.equal(result.stdout, expected);
      result = run(["--stdin-filepath=nested/a.vibe"], "export  const b = 1\n");
      assert.equal(result.status, 0, result.output);
      assert.equal(result.stdout, "export const b = 1\n");
      writeFileSync(join(cwd, ".prettierignore"), "nested/**\n");
      writeFileSync(join(cwd, "nested/b.vibe"), "export  const b = 1\n");
      result = run(["--check", "nested"]);
      assert.equal(result.status, 0, result.output);
      result = run(["--check", "nested/b.vibe"]);
      assert.equal(result.status, 0, result.output);
      assert.equal(readFileSync(join(cwd, "nested/b.vibe"), "utf8"), "export  const b = 1\n");
      result = run(["--invalid-option"]);
      assert.notEqual(result.status, 0, result.output);
      writeFileSync(join(cwd, ".oxfmtrc.json"), "{broken");
      result = run(["--check", "nested"]);
      assert.notEqual(result.status, 0, result.output);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
);
