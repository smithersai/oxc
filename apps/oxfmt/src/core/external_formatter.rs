//! String-in/string-out process boundary. The external formatter never writes
//! files: Oxfmt retains ownership of --check, --write, ignores and diagnostics.
use std::{
    io::Write,
    path::Path,
    process::{Command, Stdio},
};

use oxc_diagnostics::OxcDiagnostic;

pub(super) fn format(path: &Path, source: &str) -> Result<String, OxcDiagnostic> {
    run(path, source).map_err(OxcDiagnostic::error)
}

fn run(path: &Path, source: &str) -> Result<String, String> {
    let executable =
        std::env::var_os("OXFMT_VIBE_FORMATTER").unwrap_or_else(|| "vibelang-oxfmt".into());
    let executable_display = Path::new(&executable).display();
    let mut child = Command::new(&executable).arg(path)
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped())
        .spawn().map_err(|error| format!("Cannot start VibeLang formatter {executable_display}: {error}. Install vibelang-oxfmt or set OXFMT_VIBE_FORMATTER."))?;
    let mut stdin = child.stdin.take().expect("piped stdin");
    let (output, written) = std::thread::scope(|scope| {
        let writer = scope.spawn(move || stdin.write_all(source.as_bytes()));
        let output = child.wait_with_output();
        (output, writer.join().expect("formatter input writer panicked"))
    });
    let output = output.map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "VibeLang formatter failed for {}: {}",
            path.display(),
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    written.map_err(|error| format!("Cannot send source to VibeLang formatter: {error}"))?;
    String::from_utf8(output.stdout)
        .map_err(|error| format!("VibeLang formatter returned invalid UTF-8: {error}"))
}
