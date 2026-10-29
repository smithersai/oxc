// All ordinary document APIs come from the exact pinned upstream release.
export * from "@smithersai/oxfmt-upstream";
import { format as upstreamFormat } from "@smithersai/oxfmt-upstream";
export async function format(fileName, sourceText, options) {
  if (typeof fileName === "string" && fileName.endsWith(".vibe")) {
    const { format: vibeFormat } = await import("./vibe-index.js");
    return vibeFormat(fileName, sourceText, options);
  }
  return upstreamFormat(fileName, sourceText, options);
}
