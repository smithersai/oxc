import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const lint = resolve(process.env.OXLINT_BINARY ?? "target/debug/oxlint");
const fmt = resolve(process.env.OXFMT_BINARY ?? "target/debug/oxfmt");
function fixture(fn) {
  const cwd = mkdtempSync(join(tmpdir(), "oxc-vibe-test-"));
  try {
    const preprocess = join(cwd, "preprocess");
    const formatter = join(cwd, "formatter");
    writeFileSync(
      preprocess,
      `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const text=readFileSync(0,'utf8');
const cut=text.indexOf('effect ');
const code=cut<0?text:text.slice(0,cut)+text.slice(cut+7);
const len=s=>Buffer.byteLength(s);
const segments=cut<0?[{generatedStart:0,generatedEnd:len(code),originalStart:0,originalEnd:len(text)}]:[
{generatedStart:0,generatedEnd:len(text.slice(0,cut)),originalStart:0,originalEnd:len(text.slice(0,cut))},
{generatedStart:len(text.slice(0,cut)),generatedEnd:len(code),originalStart:len(text.slice(0,cut+7)),originalEnd:len(text)}];
console.log(JSON.stringify({code,segments:segments.filter(s=>s.generatedEnd>s.generatedStart)}));
`,
      { mode: 0o755 },
    );
    writeFileSync(
      formatter,
      `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
process.stdout.write(readFileSync(0,'utf8').replace(/ {2,}/g,' ').trim()+'\\n');
`,
      { mode: 0o755 },
    );
    const env = {
      ...process.env,
      OXLINT_VIBE_PREPROCESSOR: preprocess,
      OXFMT_VIBE_FORMATTER: formatter,
    };
    function run(binary, args, extra = {}) {
      const isJS = /\.[cm]?js$/.test(binary);
      const result = spawnSync(isJS ? process.execPath : binary, isJS ? [binary, ...args] : args, {
        cwd,
        env: { ...env, ...extra },
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      });
      assert.ifError(result.error);
      return { ...result, output: result.stdout + result.stderr };
    }
    fn({ cwd, run, preprocess });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("discovery, original paths, configured rules, mapped unicode diagnostics and safe --fix", () =>
  fixture(({ cwd, run }) => {
    writeFileSync(
      join(cwd, ".oxlintrc.json"),
      JSON.stringify({ categories: { correctness: "off" }, rules: { "no-debugger": "error" } }),
    );
    const source = "export effect function demo() { const café = 1; debugger; return café }\n";
    writeFileSync(join(cwd, "demo.vibe"), source);
    const result = run(lint, ["--format", "json", "--fix"]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /demo\.vibe/);
    assert.match(result.output, /no-debugger/);
    const json = JSON.parse(result.stdout);
    const diagnostic = json.diagnostics.find((d) => /debugger/i.test(JSON.stringify(d)));
    assert.ok(diagnostic, result.output);
    assert.equal(
      diagnostic.labels[0].span.offset,
      Buffer.byteLength(source.slice(0, source.indexOf("debugger"))),
    );
    assert.equal(readFileSync(join(cwd, "demo.vibe"), "utf8"), source);
    writeFileSync(
      join(cwd, ".oxlintrc.json"),
      JSON.stringify({ categories: { correctness: "off" }, rules: { "no-debugger": "off" } }),
    );
    assert.equal(run(lint, []).status, 0);
  }));

test("preprocessor errors fail closed without panicking", () =>
  fixture(({ cwd, run }) => {
    writeFileSync(join(cwd, "demo.vibe"), "export const x = 1;\n");
    const result = run(lint, ["demo.vibe"], { OXLINT_VIBE_PREPROCESSOR: join(cwd, "missing") });
    assert.notEqual(result.status, 0);
    assert.match(result.output, /Cannot start VibeLang preprocessor/);
    assert.doesNotMatch(result.output, /panicked/);
  }));

test("formatter discovery, check, write, repeat check and formatter-owned ignore", () =>
  fixture(({ cwd, run }) => {
    const file = join(cwd, "demo.vibe");
    writeFileSync(file, "export  const x = 1\n");
    assert.equal(run(fmt, ["--check"]).status, 1);
    assert.equal(readFileSync(file, "utf8"), "export  const x = 1\n");
    assert.equal(run(fmt, []).status, 0);
    assert.equal(readFileSync(file, "utf8"), "export const x = 1\n");
    {
      const result = run(fmt, ["--check"]);
      assert.equal(result.status, 0, result.output);
    }
    writeFileSync(file, "export  const x = 1\n");
    writeFileSync(join(cwd, "keep.ts"), "export const x = 1;\n");
    writeFileSync(join(cwd, ".prettierignore"), "demo.vibe\n");
    {
      const result = run(fmt, ["--check"]);
      assert.equal(result.status, 0, result.output);
    }
  }));

test("formatter process failure is an error and never rewrites the input", () =>
  fixture(({ cwd, run }) => {
    const file = join(cwd, "demo.vibe");
    const source = "export  const x = 1\n";
    writeFileSync(file, source);
    const result = run(fmt, [], { OXFMT_VIBE_FORMATTER: join(cwd, "missing") });
    assert.notEqual(result.status, 0);
    assert.match(result.output, /Cannot start VibeLang formatter/);
    assert.equal(readFileSync(file, "utf8"), source);
  }));

test(
  "JS plugins receive the transformed AST under the original .vibe path",
  { skip: !process.env.OXLINT_NAPI },
  () =>
    fixture(({ cwd, run }) => {
      writeFileSync(
        join(cwd, "plugin.mjs"),
        `export default { meta: { name: 'fixture' }, rules: { forbidden: { meta: { type: 'problem', schema: [], messages: { forbidden: 'plugin saw vibe' } }, create(context) { return { DebuggerStatement(node) { context.report({node,messageId:'forbidden'}); } }; } } } };`,
      );
      writeFileSync(
        join(cwd, ".oxlintrc.json"),
        JSON.stringify({
          categories: { correctness: "off" },
          jsPlugins: [{ name: "fixture", specifier: "./plugin.mjs" }],
          rules: { "fixture/forbidden": "error" },
        }),
      );
      writeFileSync(
        join(cwd, "demo.vibe"),
        "export effect function demo() { debugger; return 1 }\n",
      );
      const result = run(lint, []);
      assert.equal(result.status, 1, result.output);
      assert.match(result.output, /plugin saw vibe/);
      assert.match(result.output, /demo\.vibe/);
    }),
);
