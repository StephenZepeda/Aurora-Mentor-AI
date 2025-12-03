# AidVisor College Matching Platform

AI-powered college admissions advisor that matches students with suitable colleges based on their academic profile, career goals, financial needs, and preferences.

## Features

- 6-step wizard for comprehensive student profiling
- Real-time college matching with AI-powered recommendations
- Detailed school analysis with personalized fit information
- Merit scholarship candidacy assessment
- Progress tracking with ETA estimates
- Draft saving for later completion

## Project Structure

```
AidVisor/
├── Endpoint/              # Go backend API
│   ├── main.go
│   ├── handlers/
│   │   ├── Advisor.go
│   │   ├── Advisor_Fetch.go
│   │   ├── CollegeDetails.go
│   │   └── utils.go
│   └── go.mod
└── Webflow Code/          # Frontend (Webflow integration)
    ├── Aidvisor.html      # Main form markup
    ├── Aidvisor.css       # Styles
    ├── wizard.js          # Multi-step navigation
    ├── form.js            # Form data management
    ├── api.js             # Backend communication
    ├── ui.js              # UI rendering
    ├── details.js         # School detail panels
    └── Aidvisor_main.js   # Application entry point
```

## Quick Start

### 1. Backend Setup (Go)

1. Install Go 1.21 or higher from https://go.dev/dl/
2. Navigate to the Endpoint directory:
   ```powershell
   cd Endpoint
   ```
3. Install dependencies:
   ```powershell
   go mod download
   ```
4. Create `secrets/openai.json` with your OpenAI API key:
   ```json
   {
     "openai_api_key": "sk-..."
   }
   ```
   **Important**: This file is git-ignored and will never be committed.

5. Run the server:
   ```powershell
   go run main.go
   ```

### 2. GitHub Setup

See **[GITHUB_SETUP.md](GITHUB_SETUP.md)** for complete instructions on:
- Installing Git
- Pushing your code to GitHub
- Setting up GitHub Pages or jsDelivr CDN
- Integrating with Webflow

### 3. Frontend Setup (CSS via CDN)

If you prefer not to paste CSS into Webflow, you can load the stylesheet directly from the CDN:

- StephenZepeda/Aurora-Mentor-AI

```html
<!-- AidVisor CSS via jsDelivr CDN -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/StephenZepeda/Aurora-Mentor-AI@main/Webflow%20Code/Aidvisor.css">
```

Place this in Webflow Project Settings → Custom Code → Head Code. Replace `YOUR_USERNAME` and ensure your repo name matches.

### 4. Load HTML from GitHub (via script)

You can load `Aidvisor.html` dynamically from GitHub/CDN and inject it into a placeholder element on your Webflow page. Add a placeholder element where the form should appear, for example:

```html
<div id="aidvisor-form-mount"></div>
```

Then add this script in Webflow **Footer Code** (after your other scripts):

```html
<script>
   (function loadAidvisorHTML(){
      const mountId = 'aidvisor-form-mount';
      const el = document.getElementById(mountId);
      if (!el) { console.error('Missing mount element #' + mountId); return; }

      const url = 'https://cdn.jsdelivr.net/gh/StephenZepeda/Aurora-Mentor-AI@main/Webflow%20Code/Aidvisor.html';
      // const url = 'https://YOUR_USERNAME.github.io/aidvisor/Webflow%20Code/Aidvisor.html'; // GitHub Pages alternative

      fetch(url, { cache: 'no-cache' })
            .then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)))
            .then(html => {
               el.innerHTML = html;
               // After injecting markup, initialize components
               if (window.AidVisorInit) window.AidVisorInit();
            })
         .catch(err => { console.error('Failed to load Aidvisor.html:', err); });
   })();
</script>
```

Notes:
- Replace `YOUR_USERNAME` and, if different, `aidvisor` with your actual repository name.
- Ensure your CSS and JS files are also included (via jsDelivr or GitHub Pages) so the injected HTML has styling and logic.

## Frontend Setup (Webflow)

After setting up GitHub (see [GITHUB_SETUP.md](GITHUB_SETUP.md)), integrate with Webflow:

### Add Scripts to Webflow

In Webflow **Project Settings → Custom Code → Footer Code**:

```html
<!-- AidVisor Scripts via jsDelivr CDN -->
<script src="https://cdn.jsdelivr.net/gh/StephenZepeda/Aurora-Mentor-AI@main/Webflow%20Code/wizard.js"></script>
<script src="https://cdn.jsdelivr.net/gh/StephenZepeda/Aurora-Mentor-AI@main/Webflow%20Code/form.js"></script>
<script src="https://cdn.jsdelivr.net/gh/StephenZepeda/Aurora-Mentor-AI@main/Webflow%20Code/api.js"></script>
<script src="https://cdn.jsdelivr.net/gh/StephenZepeda/Aurora-Mentor-AI@main/Webflow%20Code/ui.js"></script>
<script src="https://cdn.jsdelivr.net/gh/StephenZepeda/Aurora-Mentor-AI@main/Webflow%20Code/details.js"></script>
<script src="https://cdn.jsdelivr.net/gh/StephenZepeda/Aurora-Mentor-AI@main/Webflow%20Code/Aidvisor_main.js"></script>
```

Replace `YOUR_USERNAME` with your GitHub username.

### Add HTML & CSS

1. Copy HTML from `Webflow Code/Aidvisor.html` into a Webflow Embed element
2. Copy CSS from `Webflow Code/Aidvisor.css` to **Page Settings → Custom Code → Head Code** (wrapped in `<style>` tags)
3. Publish your Webflow site

## API Endpoints

- `POST /CollegeAdvisor` - Submit student profile for college matching
- `POST /CollegeFetch` - Poll for matching results
- `POST /CollegeAdvisorDetails` - Request detailed school information
- `GET /CollegeAdvisorDetailsStatus` - Poll for detail generation status

## Environment Variables

- `OPENAI_API_KEY` - OpenAI API key (falls back to secrets/openai.json)

## Technologies

**Backend:**
- Go 1.21+
- OpenAI GPT-5 API
- In-memory caching with file persistence

**Frontend:**
- Vanilla JavaScript (ES6+)
- Modular architecture
- No framework dependencies
- Webflow for UI/UX

## License

MIT License

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
