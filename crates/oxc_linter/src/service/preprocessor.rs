//! External parser boundary for VibeLang. Offsets are UTF-8 bytes, as in Oxc
//! and VibeLang's native span map; gaps represent compiler-generated code.
use std::{
    io::Write,
    path::Path,
    process::{Command, Stdio},
};

use oxc_diagnostics::OxcDiagnostic;
use oxc_span::{LabeledSpan, Span};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Segment {
    generated_start: u32,
    generated_end: u32,
    original_start: u32,
    original_end: u32,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Projection {
    pub code: String,
    segments: Vec<Segment>,
}

impl Projection {
    pub fn load(path: &Path, original: &str) -> Result<Self, String> {
        let executable = std::env::var_os("OXLINT_VIBE_PREPROCESSOR")
            .unwrap_or_else(|| "vibelang-oxlint".into());
        let executable_display = Path::new(&executable).display();
        let mut child = Command::new(&executable).arg(path)
            .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped())
            .spawn().map_err(|error| format!("Cannot start VibeLang preprocessor {executable_display}: {error}. Install vibelang-oxlint or set OXLINT_VIBE_PREPROCESSOR."))?;
        let mut stdin = child.stdin.take().expect("piped stdin");
        let output = std::thread::scope(|scope| {
            let writer = scope.spawn(move || stdin.write_all(original.as_bytes()));
            let output = child.wait_with_output();
            let written = writer.join().expect("preprocessor input writer panicked");
            (output, written)
        });
        let (output, written) = output;
        let output = output.map_err(|error| error.to_string())?;
        if !output.status.success() {
            return Err(format!(
                "VibeLang preprocessor failed for {}: {}",
                path.display(),
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        written.map_err(|error| format!("Cannot send source to VibeLang preprocessor: {error}"))?;
        let projection: Self = serde_json::from_slice(&output.stdout)
            .map_err(|error| format!("Invalid VibeLang projection: {error}"))?;
        projection.validate(original)?;
        Ok(projection)
    }

    fn validate(&self, original: &str) -> Result<(), String> {
        let mut end = 0;
        for segment in &self.segments {
            let (start, next) = (segment.generated_start as usize, segment.generated_end as usize);
            let (source_start, source_end) =
                (segment.original_start as usize, segment.original_end as usize);
            if start < end
                || next <= start
                || source_end < source_start
                || !self.code.is_char_boundary(start)
                || !self.code.is_char_boundary(next)
                || !original.is_char_boundary(source_start)
                || !original.is_char_boundary(source_end)
            {
                return Err("Invalid VibeLang span map: unordered, overlapping, out-of-bounds or non-UTF-8 span".into());
            }
            end = next;
        }
        Ok(())
    }

    fn position(&self, offset: u32, end: bool) -> Option<u32> {
        let index = self.segments.partition_point(|segment| {
            if end && offset > 0 {
                segment.generated_start < offset
            } else {
                segment.generated_start <= offset
            }
        });
        let segment = self.segments.get(index.checked_sub(1)?)?;
        if offset > segment.generated_end || (!end && offset == segment.generated_end) {
            return None;
        }
        if segment.generated_end - segment.generated_start
            == segment.original_end - segment.original_start
        {
            Some(segment.original_start + offset - segment.generated_start)
        } else {
            Some(if end { segment.original_end } else { segment.original_start })
        }
    }

    pub fn remap(&self, mut diagnostic: OxcDiagnostic, original: &str) -> Option<OxcDiagnostic> {
        let had_labels = !diagnostic.labels.is_empty();
        diagnostic.labels = diagnostic
            .labels
            .iter()
            .filter_map(|label| {
                let start = self.position(label.offset(), false)?;
                let end = self
                    .position(label.offset().saturating_add(label.len()), true)
                    .unwrap_or(start);
                if end < start
                    || !original.is_char_boundary(start as usize)
                    || !original.is_char_boundary(end as usize)
                {
                    return None;
                }
                let span = Span::new(start, end);
                Some(if label.primary() {
                    LabeledSpan::new_primary_with_span(label.label().map(str::to_owned), span)
                } else {
                    LabeledSpan::new_with_span(label.label().map(str::to_owned), span)
                })
            })
            .collect();
        // Do not report rules on synthetic imports/helpers that have no source counterpart.
        (!had_labels || !diagnostic.labels.is_empty()).then_some(diagnostic)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_unicode_bytes_and_suppresses_synthetic_helpers() {
        let original = "effect f() { const café = 1 }";
        let projection = Projection {
            code: "helper(); const café = 1".into(),
            segments: vec![Segment {
                generated_start: 10,
                generated_end: 25,
                original_start: 13,
                original_end: 28,
            }],
        };
        projection.validate(original).unwrap();
        let error = OxcDiagnostic::error("unused").with_label(Span::new(16, 21));
        let mapped = projection.remap(error, original).unwrap();
        assert_eq!(mapped.labels[0].span(), Span::new(19, 24));
        assert_eq!(&original[19..24], "café");
        let synthetic = OxcDiagnostic::error("unused").with_label(Span::new(0, 6));
        assert!(projection.remap(synthetic, original).is_none());
    }

    #[test]
    fn rejects_corrupt_maps() {
        let projection = Projection {
            code: "a".into(),
            segments: vec![Segment {
                generated_start: 0,
                generated_end: 2,
                original_start: 0,
                original_end: 1,
            }],
        };
        assert!(projection.validate("a").is_err());
    }
}
