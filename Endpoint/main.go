package main

import (
	"backend/handlers"
	"log"
	"net/http"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/CollegeAdvisor", handlers.Advisor)
	mux.HandleFunc("/CollegeFetch", handlers.Advisor_Fetch)
	mux.HandleFunc("/CollegeAdvisorDetails", handlers.SchoolDetails)
	mux.HandleFunc("/CollegeAdvisorDetailsStatus", handlers.SchoolDetailsStatus)

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok\n"))
	})

	// Wrap mux with CORS
	handler := withCORS(mux)

	file_location := "/etc/letsencrypt/live/developertesting.xyz/"

	log.Println("Serving on https://developertesting.xyz")
	log.Fatal(http.ListenAndServeTLS(":443",
		file_location+"fullchain.pem",
		file_location+"privkey.pem",
		handler))
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowedOrigins := []string{
			"https://my-aidvisor.webflow.io",
			"https://www.auroramentor.ai",
		}
		origin := r.Header.Get("Origin")
		for _, o := range allowedOrigins {
			if o == origin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}
		w.Header().Set("Vary", "Origin") // tells caches the response varies by Origin
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", r.Header.Get("Access-Control-Request-Headers"))

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
