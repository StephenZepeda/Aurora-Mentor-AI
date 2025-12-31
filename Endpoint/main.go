package main

import (
	"backend/handlers"
	"flag"
	"log"
	"net/http"
	"os"
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

	defaultPort := os.Getenv("PORT")
	if defaultPort == "" {
		defaultPort = "443"
	}
	port := flag.String("port", defaultPort, "port to listen on")
	flag.Parse()
	addr := ":" + *port

	log.Printf("Serving on https://developertesting.xyz%s", addr)
	log.Fatal(http.ListenAndServeTLS(addr,
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
				// If you need cookies/authorization across origins, enable credentials
				// w.Header().Set("Access-Control-Allow-Credentials", "true")
				break
			}
		}
		w.Header().Set("Vary", "Origin") // tells caches the response varies by Origin
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		// Ensure common headers are allowed even if the browser doesn't send Access-Control-Request-Headers
		reqHeaders := r.Header.Get("Access-Control-Request-Headers")
		allowHeaders := "Content-Type"
		if reqHeaders != "" {
			allowHeaders = allowHeaders + ", " + reqHeaders
		}
		w.Header().Set("Access-Control-Allow-Headers", allowHeaders)

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
