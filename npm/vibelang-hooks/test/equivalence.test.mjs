import { test } from "node:test";
import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import { resolve, join, delimiter } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = process.env.FOLDKIT_ROOT;
const reference = process.env.VIBELANG_FORMAT_REFERENCE;
test(
  "Oxfmt agrees with the canonical VibeLang formatter on every migrated foldkit file",
  { skip: !root || !reference },
  async () => {
    const { formatSource } = await import(pathToFileURL(resolve(reference)).href);
    const files = globSync("packages/**/*.vibe", {
      cwd: root,
      exclude: (path) => /(^|[/\\])(?:node_modules|dist|build)([/\\]|$)/.test(path),
    });
    assert.ok(files.length >= 14, "expected the migrated foldkit corpus");
    for (const file of files) {
      const path = resolve(root, file);
      const source = readFileSync(path, "utf8");
      const expected = await formatSource(source, path);
      const result = spawnSync(
        process.execPath,
        [resolve(root, "node_modules/oxfmt/dist/cli.js"), "--stdin-filepath", path],
        {
          cwd: root,
          input: source,
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
          env: {
            ...process.env,
            PATH: join(root, "node_modules/.bin") + delimiter + process.env.PATH,
          },
        },
      );
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, expected, file);
    }
    console.log("canonical formatter agreement: " + files.length + " real .vibe files");
  },
);
