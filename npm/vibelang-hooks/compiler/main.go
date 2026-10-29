// Build inside a pinned VibeLang checkout; this calls VibeLang's own TypeScript
// projector, never a second implementation of the language grammar.
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/microsoft/TypeScript/tsc/internal/vibelangmapper"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: vibelang-oxlint <file.vibe> (source on stdin)")
		os.Exit(2)
	}
	text, err := io.ReadAll(os.Stdin)
	if err != nil {
		fail(err)
	}
	file, err := filepath.Abs(os.Args[1])
	if err != nil {
		fail(err)
	}
	projection := vibelangmapper.Executable(string(text), vibelangmapper.FileContext{FileName: file, ModuleKey: file})
	if len(projection.Diagnostics) != 0 {
		for _, diagnostic := range projection.Diagnostics {
			fmt.Fprintf(os.Stderr, "%s:%d: EK%d: %s\n", file, diagnostic.Start, diagnostic.Code, diagnostic.Message)
		}
		os.Exit(1)
	}
	type segment struct {
		GeneratedStart int `json:"generatedStart"`
		GeneratedEnd   int `json:"generatedEnd"`
		OriginalStart  int `json:"originalStart"`
		OriginalEnd    int `json:"originalEnd"`
	}
	segments := make([]segment, 0, len(projection.Segments))
	for _, s := range projection.Segments {
		segments = append(segments, segment{int(s.VirtualStart), int(s.VirtualEnd), int(s.OriginalStart), int(s.OriginalEnd)})
	}
	if err := json.NewEncoder(os.Stdout).Encode(struct {
		Code     string    `json:"code"`
		Segments []segment `json:"segments"`
	}{projection.Text, segments}); err != nil {
		fail(err)
	}
}

func fail(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(2) }
