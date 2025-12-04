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
	dbgPrintf("[Details] Request received from %s\n", r.RemoteAddr)

	if r.Method == http.MethodOptions {
		dbgPrintf("[Details] OPTIONS request - sending no content\n")
		writeJSON(w, http.StatusNoContent, map[string]string{"error": "MethodOptions no content"})
		return
	}
	if r.Method != http.MethodPost {
		dbgPrintf("[Details] Invalid method: %s\n", r.Method)
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	defer r.Body.Close()

	dbgPrintf("[Details] Decoding request payload\n")

	var req SchoolDetailsRequest
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		warnPrintf("[Details] JSON decode error: %v\n", err)
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"error":          "invalid json",
			"invalid_fields": map[string]any{"_": BuildJSONErrorDetail(err, r)},
		})
		return
	}
	school := strings.TrimSpace(req.School)
	if school == "" {
		dbgPrintf("[Details] Missing school name\n")
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing 'school' name"})
		return
	}

	dbgPrintf("(School)[%s] Request decoded successfully\n", school)

	// Try cache first
	cachePath := cachePathForSchool(school)
	dbgPrintf("(School)[%s] Checking cache at: %s\n", school, cachePath)
	if cached, ok, err := readFreshCache(cachePath); err == nil && ok {
		dbgPrintf("(School)[%s] ✓ Cache HIT - returning cached details\n", school)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(cached)
		return
	} else if err != nil {
		warnPrintf("(School)[%s] ✗ Cache read error: %v\n", school, err)
	} else {
		dbgPrintf("(School)[%s] ✗ Cache MISS - will generate details\n", school)
	}

	// No fresh cache -> async path
	dbgPrintf("(School)[%s] Generating job ID\n", school)
	id, err := genID()
	if err != nil {
		errPrintf("(School)[%s] Failed to generate ID: %v\n", school, err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to generate id"})
		return
	}

	dbgPrintf("(ID)[%s] (School)[%s] Job created\n", id, school)

	// Use DetailsLatency stats for a time sample the UI can use for a progress bar
	dbgPrintf("(ID)[%s] Retrieving latency statistics\n", id)
	count, _, avg := getLatencySnapshot(DetailsLatency)
	dbgPrintf("(ID)[%s] Latency stats - samples: %d, avg: %.2fms\n", id, count, avg)

	// Initial response to browser w/ time sample (ms) and sample count
	dbgPrintf("(ID)[%s] Sending initial response to client\n", id)
	writeJSON(w, http.StatusOK, map[string]any{
		"id":             id,
		"avg_chatgpt_ms": avg,   // float64
		"samples":        count, // int64
	})
	dbgPrintf("(ID)[%s] Response sent, spawning background processing\n", id)

	// Kick off background generation
	go SchoolDetails_ChatGpt(req, school, cachePath, id)
}

func SchoolDetails_ChatGpt(req SchoolDetailsRequest, school string, cachePath string, id string) {
	dbgPrintf("(ID)[%s] [Background] Details goroutine started for: %s\n", id, school)
	dbgPrintf("(ID)[%s] Saving initial 'Processing' status\n", id)
	savePrompt(id, "Processing")

	// Compact profile summary for the prompt
	var profileJSON string
	if req.Profile != nil {
		if b, err := json.MarshalIndent(req.Profile, "", "  "); err == nil {
			profileJSON = string(b)
			dbgPrintf("(ID)[%s] Student profile included (%d chars)\n", id, len(profileJSON))
		}
	} else {
		dbgPrintf("(ID)[%s] No student profile provided\n", id)
	}

	dbgPrintf("(ID)[%s] Retrieving OpenAI API key\n", id)
	key, kerr := getAPIKey()
	if kerr != nil {
		errPrintf("(ID)[%s] ✗ Error getting API key: %v\n", id, kerr)
		savePrompt(id, `{"error":"`+escapeJSON(kerr.Error())+`"}`)
		return
	}
	dbgPrintf("(ID)[%s] API key retrieved successfully\n", id)
	dbgPrintf("(ID)[%s] Initializing OpenAI client\n", id)
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

	dbgPrintf("(ID)[%s] Creating context with 3-minute timeout\n", id)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	dbgPrintf("(ID)[%s] Sending request to OpenAI GPT-5 API...\n", id)
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
	dbgPrintf("(ID)[%s] OpenAI API call completed in %.3fs\n", id, elapsed.Seconds())
	DetailsLatency.record(elapsed)

	if err != nil {
		errPrintf("(ID)[%s] ✗ OpenAI API error: %v\n", id, err)
		savePrompt(id, `{"error":"`+escapeJSON(err.Error())+`"}`)
		return
	}
	dbgPrintf("(ID)[%s] ✓ API call successful\n", id)
	out := resp.Choices[0].Message.Content
	dbgPrintf("(ID)[%s] Response length: %d chars\n", id, len(out))

	// Enforce strict JSON before sending to the client.
	dbgPrintf("(ID)[%s] Validating JSON response from model\n", id)
	var js any
	if jerr := json.Unmarshal([]byte(out), &js); jerr != nil {
		errPrintf("(ID)[%s] ✗ JSON validation failed: %v\n", id, jerr)
		savePrompt(id, `{"error":"model did not return valid JSON"}`)
		return
	}

	dbgPrintf("(ID)[%s] ✓ JSON validation passed\n", id)

	// Cache the valid JSON (best-effort)
	dbgPrintf("(ID)[%s] Saving details to cache: %s\n", id, cachePath)
	if err := writeCache(cachePath, []byte(out)); err != nil {
		warnPrintf("(School)[%s] ✗ Cache write error: %v\n", school, err)
	} else {
		dbgPrintf("(School)[%s] ✓ Details cached successfully\n", school)
	}

	dbgPrintf("(ID)[%s] (School)[%s] ChatGPT processing complete (%.3fs)\n", id, school, elapsed.Seconds())
	dbgPrintf("(ID)[%s] Saving result to prompt store\n", id)
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
		dbgPrintf("[DetailsStatus] OPTIONS request - sending no content\n")
		writeJSON(w, http.StatusNoContent, map[string]string{"error": "MethodOptions no content"})
		return
	}
	if r.Method != http.MethodGet {
		dbgPrintf("[DetailsStatus] Invalid method: %s\n", r.Method)
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		dbgPrintf("[DetailsStatus] Missing ID parameter\n")
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing id"})
		return
	}

	dbgPrintf("(ID)[%s] Status check requested\n", id)
	val, ok := getPrompt(id)
	if !ok {
		dbgPrintf("(ID)[%s] ✗ ID not found in store\n", id)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if val == "Processing" {
		dbgPrintf("(ID)[%s] Status: Still processing\n", id)
		writeJSON(w, http.StatusOK, map[string]any{"status": "processing"})
		return
	}

	// Try parse as JSON output; if it fails, treat as error string JSON we saved above.
	var parsed any
	if err := json.Unmarshal([]byte(val), &parsed); err == nil {
		dbgPrintf("(ID)[%s] ✓ Details complete, delivering to client\n", id)
		// Optional: delete once delivered to keep memory clean
		deletePrompt(id)
		writeJSON(w, http.StatusOK, map[string]any{"status": "done", "data": parsed})
		return
	}

	// If it's not valid JSON, return as error
	warnPrintf("(ID)[%s] Error status: %s\n", id, val)
	writeJSON(w, http.StatusOK, map[string]any{"status": "error", "message": val})
}
