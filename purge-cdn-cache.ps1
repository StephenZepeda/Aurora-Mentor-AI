# Purge jsDelivr CDN cache for Aurora-Mentor-AI files
# Run this after pushing changes to GitHub

Add-Type -AssemblyName System.Web

$repo = "StephenZepeda/Aurora-Mentor-AI"
$branch = "main"

$files = @(
    "Webflow Code/wizard.js",
    "Webflow Code/form.js",
    "Webflow Code/api.js",
    "Webflow Code/ui.js",
    "Webflow Code/details.js",
    "Webflow Code/Aidvisor_main.js",
    "Webflow Code/Aidvisor.css"
)

Write-Host "Purging jsDelivr CDN cache for $repo..." -ForegroundColor Cyan
Write-Host ""

foreach ($file in $files) {
    $encodedFile = [System.Web.HttpUtility]::UrlPathEncode($file)
    $purgeUrl = "https://purge.jsdelivr.net/gh/$repo@$branch/$encodedFile"
    
    Write-Host "Purging: $file" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri $purgeUrl -Method Get -ErrorAction Stop
        $result = $response.Content | ConvertFrom-Json
        
        if ($result.status -eq "finished") {
            Write-Host "  [SUCCESS] Purged from CDN" -ForegroundColor Green
        } else {
            Write-Host "  [WARNING] Status: $($result.status)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "Cache purge complete! Files should be refreshed within a few minutes." -ForegroundColor Green
Write-Host ""
Write-Host "Note: You may need to do a hard refresh (Ctrl+Shift+R) in your browser." -ForegroundColor Gray
