# AidVisor — About & FAQ

AidVisor is an AI-powered college admissions advisor that generates personalized school recommendations and tailored deep-dive details based on your academic profile, career goals, finances, location, and lifestyle preferences. The experience is embedded in Webflow with a guided, multi-step form and smooth, modern UI.

## What It Does

- Personalized matches: Recommends colleges matched to your profile and priorities.
- Guided intake: Multi-step wizard collects inputs (GPA, intended major, budget, format, include/exclude lists) and keeps them organized.
- Fast, reliable responses: Validates inputs, returns strict JSON, and uses async processing with progress estimates and background polling.
- Smart caching: Stores results and cleans stale cache weekly for faster repeat runs and lower costs.
- School deep dives: Produces student-specific detail panels (summary, what the school looks for, fit bullets, merit scholarship notes, and focused sections).
- Freemium model: Free users see 3 named schools plus 7 blurred previews; Pro users unlock the full match list and deep-dive details.
- Re-run control: Limited re-runs on Free; unlimited refines/re-runs on Pro.
- Smooth UI/UX: Custom selects, draft save/load, progress bars, inline detail panels, and refine re-runs; designed to embed in Webflow.
- Secure API: HTTPS endpoints with CORS restricted to approved origins; health check route for uptime monitoring.
- Membership integration: Upgrade prompts and plan-aware rendering; Memberstack-style tiers supported.
- Operational metrics: Tracks average model latency and sample counts to inform progress bars and time estimates.
- Maintainable contracts: Strict JSON output shape for both matches and details, keeping front-end rendering predictable.

## FAQ

### What is AidVisor?
A college admissions advisor that uses AI to recommend schools matched to your profile, preferences, and goals.

### How are matches generated?
From your academic stats, preferences, and constraints. The backend builds a structured prompt and returns strict JSON results that the UI renders.

### What do I get on the Free plan?
Three named schools plus seven blurred previews, and one re-run to refine your inputs.

### What does Pro unlock?
Full, unblurred match list and tailored detail panels (fit analysis, scholarships, focused sections), plus unlimited re-runs and refinements.

### How long do results take?
Typically seconds to a minute. The app shows an estimated time based on live latency stats and polls until results are ready.

### Can I refine my results?
Yes. Adjust inputs like distance, teaching style, housing, outcomes priority, and include/exclude lists, then re-run to update matches.

### Do you show scholarship info?
Detail panels include merit scholarship notes where available. Numeric cutoffs are conservative and may prompt you to check official sources for the latest details.

### Is my data saved?
You can save a local draft in your browser. Results are cached server-side for performance and cleaned regularly.

### Which schools are eligible?
You can include or exclude specific colleges. AidVisor prioritizes schools aligned with your preferences and constraints.

### Is the API secure?
Yes. Served over TLS with CORS limited to approved domains and an explicit health check endpoint for monitoring.

### Can I use it on Webflow?
Yes. The UI is designed to embed directly in Webflow with a modern, responsive experience.

### What happens if there’s an error?
The app returns user-friendly messages (e.g., timeouts, rate limits) and lets you retry or adjust inputs.
