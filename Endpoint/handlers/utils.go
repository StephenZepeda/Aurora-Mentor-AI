// ===== handlers/utils.go  (update) =====
package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	debug bool = true
)

func dbgPrintf(format string, args ...any) {
	if debug {
		log.Printf("[DEBUG] "+format, args...)
	}
}

func warnPrintf(format string, args ...any) {
	log.Printf("[WARN] "+format, args...)
}

func errPrintf(format string, args ...any) {
	log.Printf("[ERROR] "+format, args...)
}

// func infoPrintf(format string, args ...any) {
// 	log.Printf("[INFO] "+format, args...)
// }

// ---- Response cache with checksum ----

type cachedResponse struct {
	Timestamp int64  `json:"timestamp"`
	Response  string `json:"response"`
}

const cacheDir = "data/response_cache"

var cacheCleanupOnce sync.Once

// startCacheCleanup runs a background goroutine that cleans expired cache files weekly
func startCacheCleanup() {
	cacheCleanupOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(7 * 24 * time.Hour) // Run every week
			defer ticker.Stop()

			// Run immediately on startup, then weekly
			cleanExpiredCache()

			for range ticker.C {
				cleanExpiredCache()
			}
		}()
	})
}

// cleanExpiredCache removes all cache files older than cacheTTL
func cleanExpiredCache() {
	dbgPrintf("[cleanExpiredCache] Starting weekly cache cleanup\n")

	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		if !os.IsNotExist(err) {
			warnPrintf("[cleanExpiredCache] Error reading cache directory: %v\n", err)
		}
		return
	}

	removed := 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		path := filepath.Join(cacheDir, entry.Name())
		info, err := entry.Info()
		if err != nil {
			continue
		}

		age := time.Since(info.ModTime())
		if age > cacheTTL {
			if err := os.Remove(path); err == nil {
				removed++
			}
		}
	}

	dbgPrintf("[cleanExpiredCache] Cleanup complete: removed %d expired file(s)\n", removed)
}

func getCachedResponse(checksum string) (string, bool) {
	// Start cleanup routine on first cache access
	startCacheCleanup()

	path := filepath.Join(cacheDir, checksum+".json")
	b, err := os.ReadFile(path)
	if err != nil {
		return "", false
	}

	var cached cachedResponse
	if err := json.Unmarshal(b, &cached); err != nil {
		return "", false
	}

	// Check if cache is expired
	age := time.Since(time.Unix(cached.Timestamp, 0))
	if age > cacheTTL {
		_ = os.Remove(path)
		return "", false
	}

	return cached.Response, true
}

func saveCachedResponse(checksum string, response string) {
	_ = os.MkdirAll(cacheDir, 0o755)

	cached := cachedResponse{
		Timestamp: time.Now().Unix(),
		Response:  response,
	}

	data, err := json.MarshalIndent(cached, "", "  ")
	if err != nil {
		return
	}

	path := filepath.Join(cacheDir, checksum+".json")
	_ = os.WriteFile(path, data, 0o644)
}

func escapeJSON(s string) string {
	b, _ := json.Marshal(s) // quotes + escapes
	return string(b[1 : len(b)-1])
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// ---- In-memory prompt store ----

var promptStore = struct {
	mu sync.RWMutex
	m  map[string]string
}{m: make(map[string]string)}

func savePrompt(id, prompt string) {
	promptStore.mu.Lock()
	promptStore.m[id] = prompt
	promptStore.mu.Unlock()
}

func getPrompt(id string) (string, bool) {
	promptStore.mu.RLock()
	p, ok := promptStore.m[id]
	promptStore.mu.RUnlock()
	return p, ok
}

func deletePrompt(id string) {
	promptStore.mu.Lock()
	delete(promptStore.m, id)
	promptStore.mu.Unlock()
}

// ---- ID generator (24-char hex) ----

func genID() (string, error) {
	b := make([]byte, 12) // 96-bit ID
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func BuildJSONErrorDetail(err error, r *http.Request) map[string]any {
	body, _ := io.ReadAll(r.Body)

	// Default explanation
	detail := "The JSON could not be decoded. Ensure it's valid and matches the expected schema."

	switch {
	case errors.Is(err, io.EOF):
		detail = "The request body was empty. Did you forget to include JSON?"
	case strings.Contains(err.Error(), "invalid character"):
		detail = "The JSON contains an invalid character. " +
			"Check for stray quotes, trailing commas, or incorrect field names."
	case strings.Contains(err.Error(), "cannot unmarshal"):
		detail = "The JSON type does not match the expected Go type. " +
			"For example, you may have sent a string where a number was required."
	}

	// Try to extract offset (e.g. "invalid character 'i' looking for beginning of value at offset 12")
	line, col := -1, -1
	if off := parseOffset(err.Error()); off > 0 {
		line, col = byteOffsetToLineCol(body, off)
	}

	return map[string]any{
		"error":       err.Error(),
		"explanation": detail,
		"line":        line,
		"column":      col,
	}
}

// parseOffset extracts the "offset N" integer from a JSON error string
func parseOffset(msg string) int {
	const key = "offset "
	if i := strings.LastIndex(msg, key); i != -1 {
		if off, err := strconv.Atoi(msg[i+len(key):]); err == nil {
			return off
		}
	}
	return -1
}

// byteOffsetToLineCol converts a byte offset to line/column numbers
func byteOffsetToLineCol(src []byte, offset int) (line, col int) {
	if offset > len(src) {
		offset = len(src)
	}
	line, col = 1, 1
	for i, b := range src {
		if i >= offset {
			break
		}
		if b == '\n' {
			line++
			col = 1
		} else {
			col++
		}
	}
	return line, col
}

func getAPIKey() (string, error) {
	secretsOnce.Do(func() {
		path := os.Getenv("OPENAI_SECRETS_PATH")
		if path == "" {
			path = "data/openai.json"
		}
		if b, err := os.ReadFile(path); err == nil {
			var s secretFile
			if jerr := json.Unmarshal(b, &s); jerr == nil && strings.TrimSpace(s.OpenAIKey) != "" {
				secretVal = s
				return
			}
		}
		env := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
		if env == "" {
			secretErr = errors.New("no OpenAI API key found in secrets file or OPENAI_API_KEY")
			return
		}
		secretVal = secretFile{OpenAIKey: env}
	})
	if secretErr != nil {
		return "", secretErr
	}
	return secretVal.OpenAIKey, nil
}

type latencyStats struct {
	Count   int64   `json:"count"`
	TotalMs int64   `json:"total_ms"`
	AvgMs   float64 `json:"avg_ms"`

	path string     `json:"-"`
	mu   sync.Mutex `json:"-"`
}

const AdvisorLatencyPath = "data/chat_latency_stats.json"
const DetailsLatencyPath = "data/details_latency_stats.json"

var AdvisorLatency = newLatencyStats(AdvisorLatencyPath)
var DetailsLatency = newLatencyStats(DetailsLatencyPath)

func newLatencyStats(path string) *latencyStats {
	ls := &latencyStats{path: path}
	ls.load()
	return ls
}

func (ls *latencyStats) load() {
	ls.mu.Lock()
	defer ls.mu.Unlock()

	_ = os.MkdirAll(filepath.Dir(ls.path), 0o755)

	b, err := os.ReadFile(ls.path)
	if err != nil {
		return // first run is fine
	}
	var tmp latencyStats
	if err := json.Unmarshal(b, &tmp); err == nil {
		ls.Count = tmp.Count
		ls.TotalMs = tmp.TotalMs
		ls.AvgMs = tmp.AvgMs
	}
}

func (ls *latencyStats) save() {
	tmpPath := ls.path + ".tmp"
	data, _ := json.MarshalIndent(ls.public(), "", "  ")
	_ = os.WriteFile(tmpPath, data, 0o644)
	_ = os.Rename(tmpPath, ls.path)
}

func (ls *latencyStats) public() *latencyStats {
	return &latencyStats{
		Count:   ls.Count,
		TotalMs: ls.TotalMs,
		AvgMs:   ls.AvgMs,
	}
}

func (ls *latencyStats) record(d time.Duration) {
	ms := d.Milliseconds()

	ls.mu.Lock()
	ls.Count++
	ls.TotalMs += ms
	ls.AvgMs = float64(ls.TotalMs) / float64(ls.Count)
	ls.mu.Unlock()

	ls.save()
}

func getLatencySnapshot(latency *latencyStats) (count int64, totalMs int64, avgMs float64) {
	latency.mu.Lock()
	defer latency.mu.Unlock()
	return latency.Count, latency.TotalMs, latency.AvgMs
}
