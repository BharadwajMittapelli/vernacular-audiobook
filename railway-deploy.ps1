# Railway Deployment Automation Script
# Run this AFTER completing browser login: railway login

param(
    [string]$Repo = "BharadwajMittapelli/vernacular-audiobook",
    [string]$Branch = "master"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== Railway Auto-Configuration ===" -ForegroundColor Cyan
Write-Host ""

# Verify login
Write-Host "[1/6] Verifying Railway login..." -ForegroundColor Yellow
$whoami = railway whoami 2>&1
if ($whoami -like "*Unauthorized*") {
    Write-Host "ERROR: Not logged into Railway. Run: railway login" -ForegroundColor Red
    exit 1
}
Write-Host "  Logged in as: $whoami" -ForegroundColor Green

# Parse environment variables from .env file
Write-Host ""
Write-Host "[2/6] Reading environment configuration..." -ForegroundColor Yellow
$envContent = Get-Content "server\.env" -Raw
function Get-Env($key) {
    if ($envContent -match "^$key=(.+)$" -or $envContent -match "^$key=`"(.+)`"" -or $envContent -match "^$key='(.+)'") {
        return $matches[1]
    }
    return $null
}

$vars = @{
    SUPABASE_URL = Get-Env "SUPABASE_URL"
    SUPABASE_SERVICE_ROLE_KEY = Get-Env "SUPABASE_SERVICE_ROLE_KEY"
    SUPABASE_BUCKET_NAME = Get-Env "SUPABASE_BUCKET_NAME"
    GROQ_API_KEY = Get-Env "GROQ_API_KEY"
    GNANI_API_KEY_ID = Get-Env "GNANI_API_KEY_ID"
    PORT = Get-Env "PORT"
    TTS_PROVIDER = Get-Env "TTS_PROVIDER"
    TTS_FALLBACK_ENABLED = Get-Env "TTS_FALLBACK_ENABLED"
    NODE_ENV = "production"
}

# Ask for FRONTEND_URL (Vercel deployment)
$frontendUrl = Read-Host "Enter your Vercel frontend URL (e.g., https://your-app.vercel.app)"
$vars.FRONTEND_URL = $frontendUrl

# Check required vars
$missing = @()
foreach ($k in $vars.Keys) {
    if ([string]::IsNullOrEmpty($vars[$k])) { $missing += $k }
}
if ($missing.Count -gt 0) {
    Write-Host "ERROR: Missing env vars: $($missing -join ', ')" -ForegroundColor Red
    Write-Host "Ensure server\.env has these values set." -ForegroundColor Yellow
    exit 1
}

Write-Host "  Found: $($vars.Keys.Count) environment variables" -ForegroundColor Green

# Initialize or link project
Write-Host ""
Write-Host "[3/6] Connecting to Railway project..." -ForegroundColor Yellow
railway link --save 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  No project linked. Creating new project..." -ForegroundColor Yellow
    railway init -n "vernacular-audiobook-server" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Trying to select from existing projects..." -ForegroundColor Yellow
        railway link 2>&1 | Out-Null
    }
}

# Connect GitHub source
Write-Host ""
Write-Host "[4/6] Connecting GitHub source..." -ForegroundColor Yellow
$srcResult = railway service source connect --repo $Repo --branch $Branch --service web 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  GitHub source connected: $Repo@$Branch" -ForegroundColor Green
} else {
    Write-Host "  Source connection status: $srcResult" -ForegroundColor Yellow
    Write-Host "  (May already be connected - this is OK)" -ForegroundColor Gray
}

# Set environment variables
Write-Host ""
Write-Host "[5/6] Setting environment variables..." -ForegroundColor Yellow
foreach ($key in $vars.Keys) {
    $value = $vars[$key]
    # Mask sensitive values in output
    $displayValue = if ($key -match "KEY|SECRET|TOKEN") { "***" } else { $value }
    Write-Host "  $key = $displayValue" -NoNewline
    
    $setResult = railway variables set "$key=$value" --service web 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " (already exists)" -ForegroundColor Gray
    }
}

# Trigger deployment
Write-Host ""
Write-Host "[6/6] Triggering deployment..." -ForegroundColor Yellow
Write-Host "  This may take a few minutes. Check Railway dashboard for progress." -ForegroundColor Gray
railway up --confirm 2>&1

Write-Host ""
Write-Host "=== Configuration Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Check deployment logs: railway logs"
Write-Host "  2. View in browser: railway open"
Write-Host "  3. If healthcheck fails, verify FRONTEND_URL is correct"
Write-Host ""
