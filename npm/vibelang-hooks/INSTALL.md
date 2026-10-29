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
      oxfmt@https://github.com/smithersai/oxc/releases/download/vibe-hooks-20261029.1/smithersai-oxfmt-0.75.0-vibe.1.tgz \
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
    npm publish smithersai-oxfmt-0.75.0-vibe.1.tgz --tag vibe --access public
    npm publish smithersai-oxc-vibelang-hooks-0.1.0-vibe.2.tgz --tag vibe --access public

These artifacts contain Linux x64 binaries; other platforms require a source
build. See README.md for the hook protocol and build/pack commands.
