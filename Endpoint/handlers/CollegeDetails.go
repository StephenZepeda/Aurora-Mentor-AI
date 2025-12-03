// ===== handlers/CollegeDetails.go (drop-in) =====
package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/openai/openai-go/v2"
	"github.com/openai/openai-go/v2/option"
)

// =====================================================
//                  School Details endpoint
// =====================================================

type SchoolDetailsRequest struct {
	School  string      `json:"school"`
	Profile interface{} `json:"profile,omitempty"` // whatever your JS sends from buildPayload()
}

// ---- Cache config ----
const (
	cacheDirName = "college_details_cache" // relative to process working dir
	cacheTTL     = 7 * 24 * time.Hour      // one week
)

var slugifyRegex = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = slugifyRegex.ReplaceAllString(s, "_")
	s = strings.Trim(s, "_")
	if s == "" {
		s = "school"
	}
	return s
}

func cachePathForSchool(school string) string {
	slug := slugify(school)
	return filepath.Join(cacheDirName, slug+".json")
}

func ensureCacheDir() error {
	return os.MkdirAll(cacheDirName, 0o755)
}

func readFreshCache(path string) ([]byte, bool, error) {
	fi, err := os.Stat(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, false, nil
		}
		return nil, false, err
	}
	if time.Since(fi.ModTime()) > cacheTTL {
		return nil, false, nil
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, false, err
	}
	// Validate it's JSON
	var js any
	if err := json.Unmarshal(b, &js); err != nil {
		return nil, false, nil // treat as stale/bad cache
	}
	return b, true, nil
}

func writeCache(path string, content []byte) error {
	if err := ensureCacheDir(); err != nil {
		return err
	}
	// Validate before writing
	var js any
	if err := json.Unmarshal(content, &js); err != nil {
		return fmt.Errorf("refusing to cache invalid JSON: %w", err)
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, content, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// POST /CollegeAdvisorDetails
func SchoolDetails(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		writeJSON(w, http.StatusNoContent, map[string]string{"error": "MethodOptions no content"})
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	defer r.Body.Close()

	dbgPrintf("Details req found\n")

	var req SchoolDetailsRequest
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"error":          "invalid json",
			"invalid_fields": map[string]any{"_": BuildJSONErrorDetail(err, r)},
		})
		return
	}
	school := strings.TrimSpace(req.School)
	if school == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing 'school' name"})
		return
	}

	// Try cache first
	cachePath := cachePathForSchool(school)
	if cached, ok, err := readFreshCache(cachePath); err == nil && ok {
		dbgPrintf("Serving (%q) from cache: %s\n", school, cachePath)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(cached)
		return
	} else if err != nil {
		dbgPrintf("Cache read error for %s: %v\n", cachePath, err)
	}

	// No fresh cache -> async path
	id, err := genID()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to generate id"})
		return
	}

	// Use DetailsLatency stats for a time sample the UI can use for a progress bar
	count, _, avg := getLatencySnapshot(DetailsLatency)

	// Initial response to browser w/ time sample (ms) and sample count
	writeJSON(w, http.StatusOK, map[string]any{
		"id":             id,
		"avg_chatgpt_ms": avg,   // float64
		"samples":        count, // int64
	})

	// Kick off background generation
	go SchoolDetails_ChatGpt(req, school, cachePath, id)
}

func SchoolDetails_ChatGpt(req SchoolDetailsRequest, school string, cachePath string, id string) {
	savePrompt(id, "Processing")

	// Compact profile summary for the prompt
	var profileJSON string
	if req.Profile != nil {
		if b, err := json.MarshalIndent(req.Profile, "", "  "); err == nil {
			profileJSON = string(b)
		}
	}

	key, kerr := getAPIKey()
	if kerr != nil {
		savePrompt(id, `{"error":"`+escapeJSON(kerr.Error())+`"}`)
		return
	}
	client := openai.NewClient(option.WithAPIKey(key))

	// Prompt: ask for STRICT JSON with fields your JS expects.
	system := "You are a precise, fact-conscious college admissions advisor. Return ONLY strict JSON—no extra text."
	user := fmt.Sprintf(`
Generate a student-specific deep dive for the college below.

College: %s

Student Profile (JSON; use only what’s provided, do not invent):
%s

Return STRICT JSON matching this shape (omit empty keys):

{
  "title": "Readable name for the school",
  "summary": "1–3 sentence overview specific to the student's profile and intended major, if available.",
  "lookingFor": ["bullet about what the school values", "..." ],
  "fit": {
    "bullets": ["why this student fits / doesn't, with nuance", "..."]
  },
  "scholarships": [
    {
      "name": "Merit award name",
      "amount": "$X,XXX–$Y,YYY per year",
      "requirements": ["typical thresholds (GPA/test/portfolio) if publicly known", "renewal conditions"],
      "candidate_fit": "Are they a plausible candidate based on the provided profile?"
    }
  ],
  "sections": [
    {
      "title": "Academics & Curriculum",
      "text": "Details about curriculum flexibility, honors, research, capstone, coop/internships relevant to profile."
    },
    {
      "title": "Admissions Context",
      "text": "Class profile ranges, what the school tends to prioritize (well-rounded class vs. pointy students), and how that maps to this student."
    },
    {
      "title": "Financial Aid Notes",
      "text": "Merit vs need-based posture; special forms or deadlines; any major-specific scholarships worth checking."
    }
  ]
}

Guidelines:
- Be specific to the student where possible; if info is unknown or varies by program, say so plainly.
- Do NOT hallucinate numeric cutoffs; if uncertain, say "Check the school's official site".
- Keep claims short and scannable. No marketing fluff.
- Output ONLY the JSON object.
`, school, profileJSON)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	start := time.Now()
	resp, err := client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: openai.ChatModelGPT5,
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage(system),
			openai.UserMessage(user),
		},
	})

	// Record latency like Advisor()
	elapsed := time.Since(start)
	DetailsLatency.record(elapsed)

	if err != nil {
		savePrompt(id, `{"error":"`+escapeJSON(err.Error())+`"}`)
		return
	}
	out := resp.Choices[0].Message.Content

	// Enforce strict JSON before sending to the client.
	var js any
	if jerr := json.Unmarshal([]byte(out), &js); jerr != nil {
		savePrompt(id, `{"error":"model did not return valid JSON"}`)
		return
	}

	// Cache the valid JSON (best-effort)
	if err := writeCache(cachePath, []byte(out)); err != nil {
		dbgPrintf("Cache write error for %s: %v\n", cachePath, err)
	}

	dbgPrintf("College (%s) Details Chat GPT Prompt complete (%.3f seconds)[%s]\n", school, elapsed.Seconds(), id)
	savePrompt(id, out)
}

// GET /CollegeAdvisorDetailsStatus?id=<id>
// Returns either:
//
//	{ "status":"processing" }
//	{ "status":"done", "data": <STRICT JSON from model> }
//	{ "status":"error", "message":"..." }
func SchoolDetailsStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		writeJSON(w, http.StatusNoContent, map[string]string{"error": "MethodOptions no content"})
		return
	}
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing id"})
		return
	}

	val, ok := getPrompt(id)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if val == "Processing" {
		writeJSON(w, http.StatusOK, map[string]any{"status": "processing"})
		return
	}

	// Try parse as JSON output; if it fails, treat as error string JSON we saved above.
	var parsed any
	if err := json.Unmarshal([]byte(val), &parsed); err == nil {
		// Optional: delete once delivered to keep memory clean
		deletePrompt(id)
		writeJSON(w, http.StatusOK, map[string]any{"status": "done", "data": parsed})
		return
	}

	// If it's not valid JSON, return as error
	writeJSON(w, http.StatusOK, map[string]any{"status": "error", "message": val})
}
