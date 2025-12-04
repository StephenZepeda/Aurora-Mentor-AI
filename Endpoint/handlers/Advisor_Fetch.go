package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

func Advisor_Fetch(w http.ResponseWriter, r *http.Request) {
	dbgPrintf("[Fetch] Poll request received from %s\n", r.RemoteAddr)

	if r.Method != http.MethodPost {
		dbgPrintf("[Fetch] Invalid method: %s\n", r.Method)
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "method not allowed",
		})
		return
	}
	defer r.Body.Close()

	var body struct {
		ID string `json:"id"`
	}
	dbgPrintf("[Fetch] Decoding request body\n")
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err != io.EOF {
		warnPrintf("[Fetch] JSON decode error: %v\n", err)
		writeJSON(w, http.StatusOK, map[string]string{
			"error": "invalid JSON: " + err.Error(),
		})
		return
	}

	if body.ID == "" {
		dbgPrintf("[Fetch] Empty ID received\n")
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid ID",
		})
		return
	}

	dbgPrintf("(ID)[%s] Fetching result from prompt store\n", body.ID)
	promptStore.mu.RLock()
	defer promptStore.mu.RUnlock()
	defer promptStore.mu.RUnlock()

	if body.ID != "" {
		if val, ok := getPrompt(body.ID); ok {
			if val == "Processing" {
				dbgPrintf("(ID)[%s] Status: Still processing\n", body.ID)
			} else if strings.Contains(val, "schools") {
				dbgPrintf("(ID)[%s] ✓ Results ready, sending to client\n", body.ID)
			} else {
				dbgPrintf("(ID)[%s] Status: %s\n", body.ID, val)
			}

			writeJSON(w, http.StatusOK, map[string]string{
				"success": val,
			})

			if strings.Contains(val, "schools") {
				dbgPrintf("(ID)[%s] Final result delivered, cleaning up store\n", body.ID)
				deletePrompt(body.ID)
				return
			}
			return
		}
		dbgPrintf("(ID)[%s] ✗ ID not found in store\n", body.ID)
	}

	dbgPrintf("[Fetch] Invalid or missing ID\n")
	writeJSON(w, http.StatusBadRequest, map[string]string{
		"error": "invalid ID",
	})
}
