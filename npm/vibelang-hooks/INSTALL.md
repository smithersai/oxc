# Install the VibeLang Oxc prerelease

These experimental Linux x64 glibc packages use Node >=26 and development-profile
NAPI binaries. Source: smithersai/oxc, tag vibe-hooks-20261029.1.
The fork's main remains equal to upstream main; work is on vibe-hooks.

Keep your existing pinned VibeLang compiler/runtime dependencies.
For foldkit's local migration checkout, the compiler is installed from
file:.vibelang-toolchain/vibelang-0.0.11.tgz. Add that direct dependency if it
previously existed only as a transitive peer. The adapter compiler-source pin
is 114cb4bb0bf55cc16a7b5ab7a15c8de1b62ccb2f.

Install the scoped GitHub release tarballs under the original dependency keys,
so the repository's existing commands and config imports continue to work:

    pnpm add -Dw \
      oxlint@https://github.com/smithersai/oxc/releases/download/vibe-hooks-20261029.1/smithersai-oxlint-1.90.0-vibe.1.tgz \
      oxfmt@file:/absolute/path/smithersai-oxfmt-0.74.0-vibe.2.tgz \
      @smithersai/oxc-vibelang-hooks@https://github.com/smithersai/oxc/releases/download/vibe-hooks-20261029.1/smithersai-oxc-vibelang-hooks-0.1.0-vibe.2.tgz

pnpm users who require explicit dependency-build authorization should run:

    pnpm approve-builds dprint
    pnpm install

Existing oxlint, oxfmt, and oxfmt --check scripts now discover .vibe by default.
The hook executables are on the package-script PATH. Explicit hooks can be
selected with OXLINT_VIBE_PREPROCESSOR and OXFMT_VIBE_FORMATTER.
The release SHA256SUMS pins the tarball contents; commit your lockfile.
The formatter uses VibeLang's canonical API or dprint plugin. The fallback
plugin is bundled because the existing compiler tarball omits its referenced
archive; dprint downloads the checksum-pinned TypeScript Wasm plugin on first use.

## Scope

Oxlint applies native rules and JS plugins to emitted TypeScript, reports
mapped .vibe locations, and disables .vibe autofix. Glob overrides restricted
to *.ts need a *.vibe counterpart. Type-aware oxlint-tsgolint support and
language-server parity are not provided.

The 0.0.11-era VibeLang compiler predates some accepted VIP implementations,
including complete VIP-1 explicit effect-function lowering. Upgrade the compiler
and rebuild the projector together as those implementations land. In the
existing migrated foldkit corpus, compiler/form errors remain and make lint:ci
fail; the fork reports those errors rather than silently skipping .vibe.
The seeded lint/formatter regressions pass, but the entire foldkit migration
is not claimed green.

## Optional npm publication — Will must approve first

Nothing has been published to npm. After approval, the exact commands are:

    npm publish smithersai-oxlint-1.90.0-vibe.1.tgz --tag vibe --access public
    npm publish smithersai-oxfmt-0.74.0-vibe.2.tgz --tag vibe --access public
    npm publish smithersai-oxc-vibelang-hooks-0.1.0-vibe.2.tgz --tag vibe --access public

These artifacts contain Linux x64 binaries; other platforms require a source
build. See README.md for the hook protocol and build/pack commands.

## Version-isolated formatter packages (OXC-1 / OXC-2)

Use smithersai-oxfmt-0.74.0-vibe.2.tgz for Alchemy and T3code
(Vite+ 1.4.0 resolves oxfmt 0.74.0). Use
smithersai-oxfmt-0.66.0-vibe.2.tgz for Foldkit (lockfile 0.66.0).
These packages depend on an exact npm alias of the corresponding upstream
release. Ordinary file CLI, stdin and API formatting runs in that upstream;
the fork's 0.75 engine only receives .vibe. Both CLI passes retain config
discovery and ignores. The fork pass uses an additional temporary ignore
file that excludes every ordinary file and reincludes directories for traversal.

All-ignored inputs succeed via upstream's supported
--no-error-on-unmatched-pattern option. Upstream 0.66 and 0.74 otherwise
return 2 for these inputs; the earlier regression expectation was not the
upstream default. Invalid arguments/configs and hook failures remain errors.
The two CLI passes print separate summaries. Help/version/init/migration/LSP
are handled by upstream; this isolation does not add VibeLang LSP support.

OpenCode pins Prettier 3.6.2, not oxfmt. Keep its formatter and
vibelang/prettier integration; do not substitute an oxfmt engine.

Reproduce packaging from an already built fork npm package:
    node npm/vibelang-hooks/pack-compat.mjs <built-oxfmt-package> 0.74.0 <out>
    node npm/vibelang-hooks/pack-compat.mjs <built-oxfmt-package> 0.66.0 <out>

pack.mjs also emits both version-isolated packages. Its 0.75-vibe.1 output
is the native hook engine, not a compatible replacement for older pins.
These tarballs reuse the existing Linux x64 native binary; the changes are
JavaScript dispatch and packaging, so no Rust rebuild is required.

Validation:
    OXFMT_COMPAT=<installed-bin> OXFMT_UPSTREAM=<upstream-dist/index.js> node --test npm/vibelang-hooks/test/compat.test.mjs
    node npm/vibelang-hooks/test/typescript-parity.mjs <repo> <upstream-api> <installed-api> <result.json>
For Prettier, pass its index.mjs as both API arguments and the absolute
vibelang/prettier module path as the final argument.

Validation on nyc-02, 2026-10-29: both installed packages pass all five hook
CLI regressions plus the mixed-file compatibility regression (six each).
Full TypeScript/TSX corpus comparisons have zero differing formatter results:
Alchemy 22,166; Foldkit 3,881; T3code 24,324; OpenCode 5,479
(the last compares Prettier 3.6.2 with/without its VibeLang plugin).
CLI list-different comparisons also retain exactly the upstream mismatch
lists: Alchemy 1, Foldkit 1, T3code 23. Those existing baseline mismatches
are not newly introduced formatting differences. The two named Alchemy
repros are byte-identical through stdin with discovered configuration.
