package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

func Advisor_Fetch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "method not allowed",
		})
		return
	}
	defer r.Body.Close()

	var body struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err != io.EOF {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid JSON: " + err.Error(),
		})
		return
	}

	promptStore.mu.RLock()
	defer promptStore.mu.RUnlock()

	if body.ID != "" {
		if val, ok := getPrompt(body.ID); ok {
			writeJSON(w, http.StatusOK, map[string]string{
				"success": val,
			})
			if strings.Contains(val, "schools") {
				dbgPrintf("Advisor Prompt[%s] has been fetched, deleting\n", body.ID)
				deletePrompt(body.ID)
				return
			}
			dbgPrintf("Advisor Debug for id=%s:%+v\n", body.ID, val)
			return
		}
	}

	writeJSON(w, http.StatusBadRequest, map[string]string{
		"error": "invalid ID",
	})
}
