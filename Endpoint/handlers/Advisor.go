package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/openai/openai-go/v2"
	"github.com/openai/openai-go/v2/option"
)

/*
What’s new in this version:
- API key is loaded from JSON (default secrets/openai.json) with env fallback.
- The initial HTTP 200 response now includes {"id": "...", "avg_chatgpt_ms": <float>, "samples": <int>}.
- Same durable latency stats at data/chat_latency_stats.json (atomic writes, threadsafe).
- Fully aligned with Aidvisor.html’s payload fields and the strict JSON success/error contract your JS expects.
  (Refs: form fields & polling flow in Aidvisor.html; existing /CollegeFetch consumer.)  */

// =====================================================
//                    Secrets loader
// =====================================================

type secretFile struct {
	OpenAIKey string `json:"openai_api_key"`
}

var (
	secretsOnce sync.Once
	secretVal   secretFile
	secretErr   error
)

// =====================================================
//               Request/response structures
// =====================================================

type AdvisorRequest struct {
	// My Stats
	GPA          *string `json:"gpa"`
	WeightedGPA  *string `json:"weighted_gpa"`
	TestScore    *string `json:"test_score"`
	Coursework   *string `json:"coursework"`
	ClassRank    *string `json:"class_rank"`
	SchoolAmount *string `json:"school_amount"`

	// Academics
	IntendedMajor      *string  `json:"intended_major"`
	TeachingStyle      *string  `json:"teaching_style"`
	TeachingStyleOther *string  `json:"teaching_style_other"`
	ClassSize          *string  `json:"class_size"`
	AcceptAPIB         *string  `json:"accept_ap_ib"`
	SchoolType         *string  `json:"school_type"`
	SchoolTypeOther    *string  `json:"school_type_other"`
	ActivitiesKeywords []string `json:"activities_keywords"`

	// Career
	CareerGoal        *string `json:"career_goal"`
	CareerFlexibility *string `json:"career_flexibility"`
	ProgramFeatures   *string `json:"program_features"`

	// Finances
	Budget              *string `json:"budget"`
	EFC_SAI             *string `json:"efc_sai"`
	WillApplyAid        *string `json:"will_apply_aid"`
	ScholarshipInterest *string `json:"scholarship_interest"`
	MeritAidImportance  *string `json:"merit_aid_importance"`

	// Strategy & Timing
	CurriculumFlexibility   *string `json:"curriculum_flexibility"`
	OutcomesPriority        *string `json:"outcomes_priority"`
	OutcomesDetails         *string `json:"outcomes_details"`
	AlumniNetworkImportance *string `json:"alumni_network_importance"`
	StartYear               *string `json:"start_year"`

	// Location
	ZIPCode          *string  `json:"zip_code"`
	DistanceFromHome *string  `json:"distance_from_home"`
	CampusSetting    *string  `json:"campus_setting"`
	GeographicFeat   []string `json:"geographic_features"`
	RegionKeywords   *string  `json:"region_keywords"`
	Climate          *string  `json:"climate"`
	Format           *string  `json:"format"`
	SchoolPreference *string  `json:"school_preference"`

	// Campus Life
	HousingPreference *string  `json:"housing_preference"`
	HousingKeywords   []string `json:"housing_keywords"`

	IncludeColleges []string `json:"include_colleges"`
	ExcludeColleges []string `json:"exclude_colleges"`
}

type errorResponse struct {
	InvalidFields map[string]string `json:"invalid_fields"`
}

// =====================================================
//                    HTTP handlers
// =====================================================

func Advisor(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		writeJSON(w, http.StatusNoContent, map[string]string{"error": "MethodOptions no content"})
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	defer r.Body.Close()

	// Generate job ID and return immediately with latency snapshot (avg + samples).
	id, err := genID()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to generate id"})
		return
	}

	dbgPrintf("(ID)[%s] Advisor req found\n", id)

	var req AdvisorRequest
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20)) // 1MB safety
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"invalid_fields": map[string]any{
				"_": BuildJSONErrorDetail(err, r),
			},
		})
		return
	}

	dbgPrintf("(ID)[%s] Validating req\n", id)
	if invalid := validate(req); len(invalid) > 0 {
		writeJSON(w, http.StatusBadRequest, errorResponse{InvalidFields: invalid})
		return
	}

	// Check cache before processing
	checksum := checksumPayload(req)
	dbgPrintf("(ID)[%s] Checksum: %s\n", id, checksum)
	if cachedResp, found := getCachedResponse(checksum); found {
		dbgPrintf("(ID)[%s] Cache hit! Returning cached response\n", id)
		// Return cached response immediately, skip AI processing
		writeJSON(w, http.StatusOK, map[string]any{
			"success": cachedResp,
		})
		return
	}

	dbgPrintf("(ID)[%s] Cache miss, building prompt\n", id)
	prompt := buildPrompt(req)

	count, _, avg := getLatencySnapshot(AdvisorLatency)

	writeJSON(w, http.StatusOK, map[string]any{
		"id":             id,
		"avg_chatgpt_ms": avg,   // float64
		"samples":        count, // int64
	})

	go Aidvisor_ChatGpt(prompt, id, checksum)
}

func Aidvisor_ChatGpt(prompt string, id string, checksum string) {
	dbgPrintf("(ID)[%s] Starting ChatGPT processing\n", id)
	savePrompt(id, "Processing")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	key, kerr := getAPIKey()
	if kerr != nil {
		dbgPrintf("(ID)[%s] Error getting api key?\n", id)
		savePrompt(id, `{"error":"`+escapeJSON(kerr.Error())+`"}`)
		return
	}
	client := openai.NewClient(option.WithAPIKey(key))

	start := time.Now()
	resp, err := client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: openai.ChatModelGPT5,
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage("You are a helpful college admissions advisor."),
			openai.UserMessage(prompt),
		},
	})

	// Safety deletion in case polling never collects the result.
	go func() {
		time.Sleep(time.Minute * 10)
		if _, check := getPrompt(id); check {
			dbgPrintf("(ID)[%s] Auto-cleanup: deleting uncollected result\n", id)
			deletePrompt(id)
		}
	}()

	// Record duration for both success and error
	elapsed := time.Since(start)
	AdvisorLatency.record(elapsed)

	if err != nil {
		dbgPrintf("(ID)[%s] OpenAI API error: %v\n", id, err)
		savePrompt(id, `{"error":"`+escapeJSON(err.Error())+`"}`)
		return
	}

	out := resp.Choices[0].Message.Content

	dbgPrintf("(ID)[%s] Unmarshal the json\n", id)
	var js any
	if jerr := json.Unmarshal([]byte(out), &js); jerr != nil {
		dbgPrintf("(ID)[%s] Error w unmarshal\n", id)
		savePrompt(id, `{"error":"model did not return valid JSON"}`)
		return
	}

	dbgPrintf("(ID)[%s] ChatGPT processing complete (%.3fs)\n", id, elapsed.Seconds())
	savePrompt(id, out)

	// Save to cache
	saveCachedResponse(checksum, out)
	dbgPrintf("(ID)[%s] Response cached with checksum: %s\n", id, checksum)
}

// =====================================================
//                      Validation
// =====================================================

func validate(req AdvisorRequest) map[string]string {
	invalid := map[string]string{}

	// Helper to safely trim pointer strings
	trim := func(s *string) string {
		if s == nil {
			return ""
		}
		return strings.TrimSpace(*s)
	}

	// SchoolAmount: must be between 1 and 10
	if val := trim(req.SchoolAmount); len(val) < 1 {
		invalid["School Amount"] = "Required field"
	} else if n, err := strconv.Atoi(val); err != nil || n < 1 || n > 10 {
		invalid["School Amount"] = "Must be a number between 1 and 10"
	}

	// GPA: must be between 0 and 5.0
	if val := trim(req.GPA); len(val) < 1 {
		invalid["GPA"] = "Required field"
	} else if g, err := strconv.ParseFloat(val, 64); err != nil || g < 0 || g > 5.0 {
		invalid["GPA"] = "Must be numeric on a 0–5.0 scale"
	}

	// Weighted GPA: optional, but if provided must be between 0 and 5.0
	if val := trim(req.WeightedGPA); len(val) > 0 {
		if g, err := strconv.ParseFloat(val, 64); err != nil || g < 0 || g > 5.0 {
			invalid["Weighted GPA"] = "Must be numeric on a 0–5.0 scale"
		}
	}

	// StartYear: must be a valid 4-digit year
	if val := trim(req.StartYear); len(val) < 1 {
		invalid["Start Year"] = "Required field"
	} else if !regexp.MustCompile(`^\d{4}$`).MatchString(val) {
		invalid["Start Year"] = "Must be a 4-digit year like 2026"
	} else if n, err := strconv.Atoi(val); err != nil || n < 2025 {
		invalid["Start Year"] = "Must be a a 4 digit above 2025"
	}

	// WillApplyAid: must be Yes/No
	if val := strings.ToLower(trim(req.WillApplyAid)); len(val) < 1 {
		invalid["Financial Aid"] = "Required field"
	} else if val != "yes" && val != "no" {
		invalid["Financial Aid"] = "Must be 'Yes' or 'No'"
	}

	// ScholarshipInterest: must be merit-based/need-based/both
	if val := strings.ToLower(trim(req.ScholarshipInterest)); len(val) < 1 {
		invalid["Scholarship Interest"] = "Required field"
	} else if val != "merit-based" && val != "need-based" && val != "both" {
		invalid["Scholarship Interest"] = "Must be 'merit-based', 'need-based', or 'both'"
	}

	return invalid
}

// =====================================================
//                    Prompt builder
// =====================================================

// Keeps the strict JSON result contract (schools[] OR invalid_fields{}), which your JS already handles. :contentReference[oaicite:5]{index=5}
func buildPrompt(req AdvisorRequest) string {
	txt := func(p *string) string {
		if p == nil {
			return ""
		}
		return strings.TrimSpace(*p)
	}
	join := func(ss []string) string {
		if len(ss) == 0 {
			return ""
		}
		out := make([]string, 0, len(ss))
		for _, s := range ss {
			s = strings.TrimSpace(s)
			if s != "" {
				out = append(out, s)
			}
		}
		return strings.Join(out, ", ")
	}
	optionalSuffix := func(label, val string) string {
		if strings.TrimSpace(val) == "" {
			return ""
		}
		return fmt.Sprintf("(%s %s)", label, val)
	}

	profile := strings.TrimSpace(fmt.Sprintf(`
Student Profile
- GPA: %s
- Weighted GPA: %s
- Test Score: %s
- Coursework: %s
- Class Rank: %s

Academics
- Intended Major: %s
- Teaching Style: %s %s
- Class Size: %s
- Accept AP/IB Credit: %s
- Type of School: %s %s
- Activities Priority: %s

Career
- Goal: %s
- Flexibility: %s
- Must-Have Program Features: %s

Finances
- Budget: %s
- EFC/SAI: %s
- Will Apply for Aid: %s
- Scholarship Interest: %s
- Merit Aid Importance: %s

Strategy & Timing
- Curriculum Flexibility: %s
- Career Outcomes Priority: %s
- Details: %s
- Alumni Network Importance: %s
- Start Year: %s

Location & Format
- ZIP Code: %s
- Distance From Home: %s
- Campus Setting: %s
- Geographic Features: %s
- Region Keywords: %s
- Climate: %s
- Format: %s
- School Preference: %s

Campus Life
- Housing Preference: %s
- Housing Keywords: %s

Refinements (optional)
- Include Colleges: %s
- Exclude Colleges: %s
`,
		txt(req.GPA),
		txt(req.WeightedGPA),
		txt(req.TestScore),
		txt(req.Coursework),
		txt(req.ClassRank),

		txt(req.IntendedMajor),
		txt(req.TeachingStyle),
		optionalSuffix("Other:", txt(req.TeachingStyleOther)),
		txt(req.ClassSize),
		txt(req.AcceptAPIB),
		txt(req.SchoolType),
		optionalSuffix("Other:", txt(req.SchoolTypeOther)),
		join(req.ActivitiesKeywords),

		txt(req.CareerGoal),
		txt(req.CareerFlexibility),
		txt(req.ProgramFeatures),

		txt(req.Budget),
		txt(req.EFC_SAI),
		txt(req.WillApplyAid),
		txt(req.ScholarshipInterest),
		txt(req.MeritAidImportance),

		txt(req.CurriculumFlexibility),
		txt(req.OutcomesPriority),
		txt(req.OutcomesDetails),
		txt(req.AlumniNetworkImportance),
		txt(req.StartYear),

		txt(req.ZIPCode),
		txt(req.DistanceFromHome),
		txt(req.CampusSetting),
		join(req.GeographicFeat),
		txt(req.RegionKeywords),
		txt(req.Climate),
		txt(req.Format),
		txt(req.SchoolPreference),

		txt(req.HousingPreference),
		join(req.HousingKeywords),
		strings.Join(req.IncludeColleges, ", "),
		strings.Join(req.ExcludeColleges, ", "),
	))

	jsonContract := strings.TrimSpace(fmt.Sprintf(`
Return your result as STRICT JSON ONLY (no prose). Two possible shapes:

1) Success format:
{
  "schools": [
    {
      "name": "School Name",
      "chance_percent": 75,
      "distance_from_location": "1200 miles",
      "category": "Reach|Match|Safety",
      "reasoning": "Short explanation"
    }
  ]
}

2) Error format (for missing/invalid/unclear inputs):
{
  "invalid_fields": {
    "GPA": "Must be numeric on a 0-4.0 scale",
    "Location": "Required or provide a ZIP code",
    "SAT": "Must be a number or 'not taken'"
  }
}

Rules:
- If key inputs are missing or unclear (e.g., non-numeric GPA, impossible ranges), return ONLY invalid_fields.
- Otherwise, return ONLY schools with the top %s options, in DESC order by chance, each categorized as Reach/Match/Safety with a short reasoning. standardize the distribution of safety (12.5%) to match (75%) to reach schools (12.5%)
- Do not include any text outside of the JSON object.
`, txt(req.SchoolAmount)))
	return fmt.Sprintf(
		"I want you to act as a college admissions advisor.\n\n%s\n\n%s",
		profile, jsonContract,
	)
}

// =====================================================
//                 Checksum calculation
// =====================================================

func checksumPayload(req AdvisorRequest) string {
	// Create a deterministic JSON representation by sorting keys
	data, err := json.Marshal(req)
	if err != nil {
		return ""
	}

	// Parse and re-marshal with sorted keys
	var obj map[string]interface{}
	if err := json.Unmarshal(data, &obj); err != nil {
		return ""
	}

	sortedJSON := marshalSorted(obj)

	// Calculate SHA-256 hash
	hash := sha256.Sum256([]byte(sortedJSON))
	return hex.EncodeToString(hash[:])
}

func marshalSorted(obj interface{}) string {
	switch v := obj.(type) {
	case map[string]interface{}:
		keys := make([]string, 0, len(v))
		for k := range v {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		parts := make([]string, 0, len(keys))
		for _, k := range keys {
			parts = append(parts, fmt.Sprintf("%q:%s", k, marshalSorted(v[k])))
		}
		return "{" + strings.Join(parts, ",") + "}"

	case []interface{}:
		parts := make([]string, len(v))
		for i, item := range v {
			parts[i] = marshalSorted(item)
		}
		return "[" + strings.Join(parts, ",") + "]"

	case string:
		return fmt.Sprintf("%q", v)

	case nil:
		return "null"

	default:
		return fmt.Sprintf("%v", v)
	}
}
