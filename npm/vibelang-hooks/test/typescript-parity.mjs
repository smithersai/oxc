import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
const [repo, reference, candidate, out, plugin] = process.argv.slice(2);
const upstream = await import(pathToFileURL(resolve(reference)));
const fork = await import(pathToFileURL(resolve(candidate)));
const files = [];
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (
      ["node_modules", ".jj", ".git", "dist", "build", ".next", ".vibelang-toolchain"].includes(
        e.name,
      )
    )
      continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile() && /\.tsx?$/.test(p)) files.push(p);
  }
}
walk(resolve(repo));
let index = 0;
const differences = [];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (index < files.length) {
      const file = files[index++];
      const source = readFileSync(file, "utf8");
      const evaluate = async (formatter, options) => {
        try {
          return await formatter.format(
            ...(plugin ? [source, { filepath: file, ...options }] : [file, source]),
          );
        } catch (error) {
          return { error: error.message };
        }
      };
      const a = await evaluate(upstream, {});
      const b = await evaluate(fork, plugin ? { plugins: [plugin] } : {});
      if (JSON.stringify(a) !== JSON.stringify(b)) differences.push(file);
    }
  }),
);
const result = { repo, reference, files: files.length, differences };
writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
if (differences.length) process.exitCode = 1;
