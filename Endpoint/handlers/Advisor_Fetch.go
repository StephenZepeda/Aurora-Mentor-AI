package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

func Advisor_Fetch(w http.ResponseWriter, r *http.Request) {
	dbgPrintf("[Advisor_Fetch] Poll request received from %s\n", r.RemoteAddr)

	if r.Method != http.MethodPost {
		dbgPrintf("[Advisor_Fetch] Invalid method: %s\n", r.Method)
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "method not allowed",
		})
		return
	}
	defer r.Body.Close()

	var body struct {
		ID string `json:"id"`
	}
	dbgPrintf("[Advisor_Fetch] Decoding request body\n")
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err != io.EOF {
		warnPrintf("[Advisor_Fetch] JSON decode error: %v\n", err)
		writeJSON(w, http.StatusOK, map[string]string{
			"error": "invalid JSON: " + err.Error(),
		})
		return
	}

	if body.ID == "" {
		dbgPrintf("[Advisor_Fetch] Empty ID received\n")
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid ID",
		})
		return
	}

	dbgPrintf("[Advisor_Fetch] (ID)[%s] Fetching result from prompt store\n", body.ID)

	val, ok := getPrompt(body.ID)
	if !ok {
		dbgPrintf("[Advisor_Fetch] (ID)[%s] ✗ ID not found in store\n", body.ID)
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid ID",
		})
		return
	}

	if val == "Processing" {
		dbgPrintf("[Advisor_Fetch] (ID)[%s] Status: Still processing\n", body.ID)
	} else if strings.Contains(val, "schools") {
		dbgPrintf("[Advisor_Fetch] (ID)[%s] ✓ Results ready, sending to client\n", body.ID)
	} else {
		dbgPrintf("[Advisor_Fetch] (ID)[%s] Status: %s\n", body.ID, val)
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"success": val,
	})

	if strings.Contains(val, "schools") {
		dbgPrintf("[Advisor_Fetch] (ID)[%s] Final result delivered, cleaning up store\n", body.ID)
		deletePrompt(body.ID)
	}
}
