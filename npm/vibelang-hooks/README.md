# VibeLang hooks for Oxlint and Oxfmt

Experimental CLI support in the smithersai Oxc fork. AI-assisted implementation;
the submitting contributor must review and take responsibility before upstream submission.

## Design

Oxlint discovers .vibe by default. It runs the VibeLang compiler's executable
TypeScript projection, then its existing native and JS plugin rule pipeline.
Config discovery, overrides and plugin filenames use the original .vibe path.
Overrides explicitly limited to *.ts must be extended to *.vibe by their owner.
UTF-8 byte span maps translate diagnostic labels back to the original source.
Compiler-generated helpers without mapped source labels are suppressed.
Autofixes are disabled for .vibe: generated TypeScript edits cannot safely be
written to VibeLang. This is syntactic lint support, not oxlint-tsgolint support;
VIP-38 assigns Effect type-aware lint to the VibeLang compiler.

Oxfmt classifies .vibe as an external formatting strategy. Oxfmt owns discovery,
ignores, --check, and writes. The hook returns formatted text and never edits
the input. It resolves the consuming project's vibelang/format API, or falls
back to the same shipped dprint process plugin and pinned TypeScript formatter
used by VibeLang's formatting command. Oxfmt style options do not override
VibeLang's canonical style. This boundary can later become an extension registry
without teaching Oxc the VibeLang grammar.

## Hook protocol

Executable paths (not shell command strings) can be overridden with
OXLINT_VIBE_PREPROCESSOR and OXFMT_VIBE_FORMATTER. Defaults are vibelang-oxlint
and vibelang-oxfmt on PATH. Each receives one argument, the source filename,
and UTF-8 source on stdin. Nonzero exit status fails closed.
The formatter writes UTF-8 text. The preprocessor writes JSON with code and
segments fields. Each segment contains generatedStart, generatedEnd,
originalStart, originalEnd. All offsets are UTF-8 bytes, half-open.
Segments must be ordered and non-overlapping in generated text, in bounds and
at character boundaries. Gaps represent synthetic code. Equal-length segments
map byte for byte; other segments map to their whole original source range.
No shell is used. Concurrent input and output prevent pipe deadlocks.

## Build and install

Linux x64 glibc and Node >=26 are the initial binary target. Other platforms
must build from source. No npm publication is performed.

Build Oxc with Rust 1.99.1, Node 26, pnpm 12.7.0:
pnpm install; cargo build -p oxlint -p oxfmt;
pnpm --dir apps/oxlint build-js; pnpm --dir apps/oxfmt build-js.
Copy target/debug/liboxlint.so and liboxfmt.so to their respective
apps/<tool>/dist/<tool>.linux-x64-gnu.node after building JS.
Build the compiler hook with Go 1.27:
node npm/vibelang-hooks/build-preprocessor.mjs /path/to/pinned/vibelang /absolute/path/to/vibelang-oxlint.
The adapter uses VibeLang's internal vibelangmapper.Executable API; pin and
rebuild it alongside your compiler, rather than mixing language versions.

node npm/vibelang-hooks/pack.mjs /absolute/path/to/vibelang-oxlint /path/to/vibelang/packages/compiler /absolute/output/dir
creates @smithersai/oxlint, @smithersai/oxfmt, and
@smithersai/oxc-vibelang-hooks npm tarballs, including Linux NAPI binaries.
Install those tarballs under the original dependency keys so existing scripts
and imports stay intact. Keep your project's pinned VibeLang dependency.
The release INSTALL.md supplies exact asset URLs and optional npm publish commands.

## Verification

node --test npm/vibelang-hooks/test/cli.test.mjs tests native CLIs.
Set OXLINT_BINARY=.../apps/oxlint/dist/cli.js,
OXFMT_BINARY=.../apps/oxfmt/dist/cli.js and OXLINT_NAPI=1 to test the
NAPI CLIs including JS plugins. Real foldkit probes and formatter equivalence
are recorded in the release verification notes. LSP/type-aware lint are not
claimed by these CLI checks.

The prerelease bundles the pinned VibeLang formatter plugin as a fallback for
compiler tarballs that omit their referenced native plugin archive. This is
VibeLang's formatter binary, not a reimplementation.

## Compiler pin and language coverage

The prerelease adapter is built from VibeLang source
114cb4bb0bf55cc16a7b5ab7a15c8de1b62ccb2f (compiler sources unchanged by
the local migration-script edits). The existing 0.0.11 compiler predates some
accepted VIP implementations: VIP-1's explicit effect-function syntax is not
fully lowered. These hooks delegate syntax to VibeLang and fail closed on
invalid emitted TypeScript; they do not claim compiler conformance to every
accepted VIP. Rebuild the adapter when upgrading VibeLang.
The packaged NAPI binaries use the Rust development profile.
