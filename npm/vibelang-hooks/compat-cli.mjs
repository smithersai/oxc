import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const args = process.argv.slice(2);
const upstream = new URL("./cli.js", import.meta.resolve("@smithersai/oxfmt-upstream"));
const vibe = new URL("./vibe-cli.js", import.meta.url);
function run(entry, argv) {
  const child = spawnSync(process.execPath, [fileURLToPath(entry), ...argv], {
    stdio: ["inherit", "pipe", "inherit"],
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (child.stdout) {
    process.stdout.write(child.stdout);
    // list-different in older upstream releases omits its final newline.
    // Keep the second pass from concatenating a summary onto a filename.
    if (args.includes("--list-different") && !child.stdout.endsWith("\n"))
      process.stdout.write("\n");
  }
  if (child.error) throw child.error;
  return child.status ?? 2;
}
const stdinIndex = args.indexOf("--stdin-filepath");
const stdinPath =
  stdinIndex >= 0
    ? args[stdinIndex + 1]
    : args.find((a) => a.startsWith("--stdin-filepath="))?.slice(17);
if (stdinPath) {
  process.exitCode = run(stdinPath.endsWith(".vibe") ? vibe : upstream, args);
} else if (
  args.some(
    (a) =>
      ["--help", "-h", "--version", "-V", "--lsp", "--init"].includes(a) ||
      a.startsWith("--migrate"),
  )
) {
  process.exitCode = run(upstream, args);
} else {
  // Each pass may legitimately have no files. Use the supported upstream option;
  // never swallow exit 2, which also represents real config and argument errors.
  const tolerant = [...args, "--no-error-on-unmatched-pattern"];
  const ordinaryStatus = run(upstream, [...tolerant, "!**/*.vibe"]);
  if (ordinaryStatus > 1) {
    process.exitCode = ordinaryStatus;
  } else {
    const temporary = mkdtempSync(join(tmpdir(), "oxfmt-vibe-only-"));
    try {
      const ignore = join(temporary, "ignore");
      // Reinclude directories for traversal; only .vibe files are eligible.
      writeFileSync(ignore, "*\n!*/\n!*.vibe\n");
      const ignored = [...tolerant];
      if (
        !args.some((a) => a === "--ignore-path" || a.startsWith("--ignore-path=")) &&
        existsSync(".prettierignore")
      ) {
        ignored.push("--ignore-path", ".prettierignore");
      }
      ignored.push("--ignore-path", ignore);
      process.exitCode = Math.max(ordinaryStatus, run(vibe, ignored));
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
}
