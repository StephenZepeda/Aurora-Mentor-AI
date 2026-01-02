# Complete deployment script for AidVisor
# This script: commits changes, pushes to GitHub, updates URLs to commit hash

param(
    [string]$CommitMessage = "Update AidVisor code"
)

$repo = "StephenZepeda/Aurora-Mentor-AI"
$embedFile = "Webflow Code\Webflow_Embed_Snippet.html"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AidVisor Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check for changes
Write-Host "[1/5] Checking for changes..." -ForegroundColor Yellow
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "  No changes to commit." -ForegroundColor Green
    $skipCommit = $true
} else {
    Write-Host "  Changes detected:" -ForegroundColor Green
    git status --short
    $skipCommit = $false
}
Write-Host ""

# Step 2: Commit changes
if (-not $skipCommit) {
    Write-Host "[2/5] Committing changes..." -ForegroundColor Yellow
    git add .
    git commit -m $CommitMessage
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Error: Commit failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Committed successfully" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[2/5] Skipping commit (no changes)" -ForegroundColor Yellow
    Write-Host ""
}

# Step 3: Push to GitHub
if (-not $skipCommit) {
    Write-Host "[3/5] Pushing to GitHub..." -ForegroundColor Yellow
    git push origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Error: Push failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Pushed successfully" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[3/5] Skipping push (no changes)" -ForegroundColor Yellow
    Write-Host ""
}

# Step 4: Get commit hash and update embed file
Write-Host "[4/5] Updating CDN URLs to commit hash..." -ForegroundColor Yellow
$commitHash = (git rev-parse HEAD).Trim()
Write-Host "  Commit: $commitHash" -ForegroundColor Cyan

$content = Get-Content $embedFile -Raw
$pattern = "cdn\.jsdelivr\.net/gh/$([regex]::Escape($repo))@[^/]+/"
$replacement = "cdn.jsdelivr.net/gh/$repo@$commitHash/"

$newContent = $content -replace $pattern, $replacement
Set-Content $embedFile -Value $newContent -NoNewline

Write-Host "  Updated embed file with commit hash" -ForegroundColor Green
Write-Host ""

# Step 5: Final instructions
Write-Host "[5/5] Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Next Steps:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Open: $embedFile" -ForegroundColor White
Write-Host "2. Copy the entire content" -ForegroundColor White
Write-Host "3. Paste into your Webflow custom code element" -ForegroundColor White
Write-Host "4. Publish your Webflow site" -ForegroundColor White
Write-Host ""
Write-Host "Your CDN URLs now point to commit: $commitHash" -ForegroundColor Cyan
Write-Host "This ensures you get the exact version (no cache issues!)" -ForegroundColor Green
Write-Host ""
