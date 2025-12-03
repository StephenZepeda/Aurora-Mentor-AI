# GitHub Setup Guide for AidVisor

## Prerequisites

### 1. Install Git
If Git is not installed, download and install from: https://git-scm.com/download/win

After installation, restart PowerShell or VS Code terminal.

### 2. Configure Git (First Time Only)
```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## Step-by-Step Setup

### Step 1: Initialize Local Repository
```powershell
cd "c:\Users\Zev\Desktop\temp\AidVisor"
git init
git add .
git commit -m "Initial commit: AidVisor college matching platform"
```

### Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. **Repository name**: `aidvisor` (or your preferred name)
3. **Description**: "AI-powered college admissions advisor"
4. **Visibility**: Choose **Public** (required for GitHub Pages/jsDelivr CDN)
5. **DO NOT** check "Add a README file" (we already have one)
6. **DO NOT** add .gitignore or license (we have them)
7. Click **"Create repository"**

### Step 3: Connect Local to GitHub

GitHub will show you commands. Use these (replace with your actual values):

```powershell
# Add GitHub as remote
git remote add origin https://github.com/YOUR_USERNAME/aidvisor.git

# Push your code
git branch -M main
git push -u origin main
```

**Important**: When prompted, use a **Personal Access Token** instead of password:
- Go to https://github.com/settings/tokens
- Click "Generate new token (classic)"
- Give it a name like "AidVisor"
- Check "repo" scope
- Copy the token and use it as your password

### Step 4: Verify Upload

1. Go to your GitHub repository page
2. You should see all files except:
   - `secrets/` folder (contains API keys - properly ignored)
   - Any `.key` or `.pem` files
   - The deleted `My Notes.md` (contained API keys)

## Security Checklist

Before pushing to GitHub, verify these files are **NOT** visible:

- ❌ `secrets/` directory
- ❌ `secrets/openai.json`
- ❌ Any files with API keys
- ✅ `.gitignore` (should be present)
- ✅ Source code files
- ✅ `README.md`

## What Was Cleaned Up

The following files were removed because they contained sensitive data or redundant information:

1. **My Notes.md** - Contained exposed API keys (SECURITY RISK)
2. **Endpoint.md** - Documentation now in README.md
3. **Webflow AI Code.md** - Documentation now in README.md
4. **WEBFLOW_SETUP.md** - Documentation now in README.md

## Next Steps: Webflow Integration

### Option 1: jsDelivr CDN (Recommended - Fastest & Free)

After pushing to GitHub, add this to Webflow **Project Settings → Custom Code → Footer Code**:

```html
<!-- AidVisor Scripts -->
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/aidvisor@main/Webflow%20Code/wizard.js"></script>
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/aidvisor@main/Webflow%20Code/form.js"></script>
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/aidvisor@main/Webflow%20Code/api.js"></script>
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/aidvisor@main/Webflow%20Code/ui.js"></script>
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/aidvisor@main/Webflow%20Code/details.js"></script>
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/aidvisor@main/Webflow%20Code/Aidvisor_main.js"></script>
<!-- AidVisor CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/aidvisor@main/Webflow%20Code/Aidvisor.css">

<!-- Optional: Dynamically load HTML markup -->
<script>
   (function(){
      const mountId = 'aidvisor-form-mount';
      const el = document.getElementById(mountId);
      if (!el) return; // create <div id="aidvisor-form-mount"></div> where the form should appear
      const url = 'https://cdn.jsdelivr.net/gh/YOUR_USERNAME/aidvisor@main/Webflow%20Code/Aidvisor.html';
      fetch(url, { cache: 'no-cache' })
         .then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)))
         .then(html => {
            el.innerHTML = html;
            // Initialize components after injection
            if (window.AidVisorInit) window.AidVisorInit();
         })
         .catch(err => { console.error('Failed to load Aidvisor.html:', err); });
   })();
</script>
```

Replace `YOUR_USERNAME` with your GitHub username.

### Option 2: GitHub Pages

1. In your GitHub repository, go to **Settings → Pages**
2. Under "Source", select **"main"** branch
3. Click **"Save"**
4. Your files will be available at: `https://YOUR_USERNAME.github.io/aidvisor/`

Then use these script tags in Webflow:

```html
<!-- AidVisor Scripts -->
<script src="https://YOUR_USERNAME.github.io/aidvisor/Webflow%20Code/wizard.js"></script>
<script src="https://YOUR_USERNAME.github.io/aidvisor/Webflow%20Code/form.js"></script>
<script src="https://YOUR_USERNAME.github.io/aidvisor/Webflow%20Code/api.js"></script>
<script src="https://YOUR_USERNAME.github.io/aidvisor/Webflow%20Code/ui.js"></script>
<script src="https://YOUR_USERNAME.github.io/aidvisor/Webflow%20Code/details.js"></script>
<script src="https://YOUR_USERNAME.github.io/aidvisor/Webflow%20Code/Aidvisor_main.js"></script>
<!-- AidVisor CSS -->
<link rel="stylesheet" href="https://YOUR_USERNAME.github.io/aidvisor/Webflow%20Code/Aidvisor.css">

<!-- Optional: Dynamically load HTML markup -->
<script>
   (function(){
      const mountId = 'aidvisor-form-mount';
      const el = document.getElementById(mountId);
      if (!el) return; // create <div id="aidvisor-form-mount"></div>
      const url = 'https://YOUR_USERNAME.github.io/aidvisor/Webflow%20Code/Aidvisor.html';
      fetch(url, { cache: 'no-cache' })
         .then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)))
         .then(html => {
            el.innerHTML = html;
            if (window.AidVisorInit) window.AidVisorInit();
         })
         .catch(err => { console.error('Failed to load Aidvisor.html:', err); });
   })();
</script>
```

## Updating Code After Changes

When you make changes to your code:

```powershell
# Stage all changes
git add .

# Commit with a descriptive message
git commit -m "Description of what you changed"

# Push to GitHub
git push
```

**Note**: CDN caching means updates may take a few minutes to several hours to appear. For immediate updates, use version tags:

```powershell
# Create a version tag
git tag v1.0.1
git push --tags
```

Then update your Webflow scripts to use the specific version:
```html
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/aidvisor@v1.0.1/Webflow%20Code/wizard.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/aidvisor@v1.0.1/Webflow%20Code/Aidvisor.css">
```

## Troubleshooting

### "fatal: not a git repository"
Run `git init` first.

### "Authentication failed"
Use a Personal Access Token instead of your password. See Step 3 above.

### "nothing added to commit"
Make sure you're in the correct directory: `cd "c:\Users\Zev\Desktop\temp\AidVisor"`

### Scripts not loading in Webflow
- Verify repository is **Public**
- Check GitHub username is correct in URLs
- Wait 5-10 minutes for CDN to cache files
- Check browser console for 404 errors

### API Keys accidentally pushed
If you accidentally pushed API keys to GitHub:
1. **Immediately revoke/regenerate** the keys at OpenAI
2. Delete the repository or use `git filter-branch` to remove history
3. Create new keys and store them only in `secrets/openai.json`

## Support

For issues:
1. Check the browser console (F12) for JavaScript errors
2. Verify backend is running: https://developertesting.xyz/healthz
3. Check GitHub Actions (if configured) for deployment status
