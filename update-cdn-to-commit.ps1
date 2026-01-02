# Update CDN URLs to use latest commit hash instead of @main
# This ensures you get the exact version you pushed, bypassing cache issues

$repo = "StephenZepeda/Aurora-Mentor-AI"
$embedFile = "Webflow Code\Webflow_Embed_Snippet.html"

# Get the latest commit hash
try {
    $commitHash = git rev-parse HEAD
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to get commit hash"
    }
    $commitHash = $commitHash.Trim()
    
    Write-Host "Latest commit hash: $commitHash" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Error: Could not get commit hash. Make sure you're in a git repository." -ForegroundColor Red
    exit 1
}

# Read the embed file
if (-not (Test-Path $embedFile)) {
    Write-Host "Error: $embedFile not found" -ForegroundColor Red
    exit 1
}

$content = Get-Content $embedFile -Raw

# Replace @main with @commit-hash in all CDN URLs
# Pattern matches both with and without URL encoding
$pattern = "cdn\.jsdelivr\.net/gh/$([regex]::Escape($repo))@main/"
$replacement = "cdn.jsdelivr.net/gh/$repo@$commitHash/"

$newContent = $content -replace $pattern, $replacement

# Count replacements
$oldMatches = [regex]::Matches($content, $pattern)
$newMatches = [regex]::Matches($newContent, [regex]::Escape($replacement))

if ($oldMatches.Count -eq 0) {
    Write-Host "No @main URLs found. File may already be using commit hash." -ForegroundColor Yellow
    Write-Host "Current pattern in file:" -ForegroundColor Yellow
    if ($content -match "https://cdn\.jsdelivr\.net/gh/$repo@([^/]+)/") {
        Write-Host "  Using: @$($matches[1])" -ForegroundColor Cyan
    }
} else {
    # Write the updated content
    Set-Content $embedFile -Value $newContent -NoNewline
    
    Write-Host "Updated $($oldMatches.Count) CDN URL(s) to use commit @$commitHash" -ForegroundColor Green
    Write-Host ""
    Write-Host "Files updated:" -ForegroundColor Cyan
    Write-Host "  - $embedFile" -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Copy the updated snippet to your Webflow custom code" -ForegroundColor White
    Write-Host "  2. Publish your Webflow site" -ForegroundColor White
    Write-Host "  3. The CDN will serve the exact commit version (no cache issues!)" -ForegroundColor White
}
