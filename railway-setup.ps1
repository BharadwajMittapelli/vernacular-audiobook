# Railway Deployment Setup Script
# Run this after logging in with: railway login --browserless
# This will configure your Railway project for successful deployment

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "=== Railway Deployment Setup ===" -ForegroundColor Cyan
Write-Host ""

# Read env values (securely, not printing secrets)
$envFile = "server\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: server\.env not found" -ForegroundColor Red
    exit 1
}

# Parse .env file
function Get-EnvValue($key) {
    $line = Get-Content $envFile | Select-String "^$key="
    if ($line) {
        return ($line -replace "^$key=", "").Trim()
    }
    return $null
}

$supabaseUrl = Get-EnvValue "SUPABASE_URL"
$supabaseKey = Get-EnvValue "SUPABASE_SERVICE_ROLE_KEY"
$groqKey = Get-EnvValue "GROQ_API_KEY"
$gnaniKeyId = Get-EnvValue "GNANI_API_KEY_ID"
$bucketName = Get-EnvValue "SUPABASE_BUCKET_NAME"

Write-Host "Reading config from server\.env..." -ForegroundColor Yellow

# Step 1: Check login status
Write-Host ""
Write-Host "Step 1: Checking Railway login..." -ForegroundColor Green
$whoami = railway whoami 2>&1
if ($whoami -like "*Unauthorized*") {
    Write-Host "Not logged in. Opening browser for login..." -ForegroundColor Yellow
    railway login --browserless
    Start-Sleep -Seconds 3
}

# Step 2: Check if project is linked
Write-Host ""
Write-Host "Step 2: Checking project link..." -ForegroundColor Green
$linkedProject = railway status 2>&1
if ($linkedProject -like "*No project linked*") {
    Write-Host "No project linked. Creating new project..." -ForegroundColor Yellow
    railway init -n vernacular-audiobook-server
}

# Step 3: Link to project if needed
Write-Host ""
Write-Host "Step 3: Ensuring project is linked..." -ForegroundColor Green
railway link --save

# Step 4: Connect GitHub source
Write-Host ""
Write-Host "Step 4: Connecting GitHub source..." -ForegroundColor Green
railway service source connect --repo BharadwajMittapelli/vernacular-audiobook --branch master --service web 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Source may already be connected or needs manual setup" -ForegroundColor Yellow
}

# Step 5: Set environment variables
Write-Host ""
Write-Host "Step 5: Setting environment variables..." -ForegroundColor Green

$envVars = @{
    "SUPABASE_URL" = $supabaseUrl
    "SUPABASE_BUCKET_NAME" = $bucketName
    "PORT" = "4001"
    "NODE_ENV" = "production"
    "TTS_PROVIDER" = "gnani"
    "TTS_FALLBACK_ENABLED" = "true"
    "GROQ_API_KEY" = $groqKey
    "GNANI_API_KEY_ID" = $gnaniKeyId
    "FRONTEND_URL" = "https://your-app.vercel.app"  # Update with your actual Vercel URL
}

foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    Write-Host "  Setting $key..." -NoNewline
    railway variables set "$key=$value" --service web 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " (may already exist)" -ForegroundColor Yellow
    }
}

# Set the sensitive key separately (masked output)
Write-Host "  Setting SUPABASE_SERVICE_ROLE_KEY..." -NoNewline
railway variables set "SUPABASE_SERVICE_ROLE_KEY=$supabaseKey" --service web 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
}

# Step 6: Trigger deployment
Write-Host ""
Write-Host "Step 6: Triggering deployment..." -ForegroundColor Green
railway up --confirm

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "Check your Railway dashboard for deployment status." -ForegroundColor Yellow
Write-Host "If deployment fails, check logs: railway logs" -ForegroundColor Yellow
