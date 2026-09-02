# SecureFlow — one-time Docker setup (Windows / PowerShell)
#
# Run this once after cloning the repo, from the repo root:
#     .\setup.ps1
#
# It copies the .env.docker.example templates to real .env.docker files
# (only if they don't already exist — never overwrites what you have),
# then tells you which values you still need to fill in before running:
#     docker compose up --build

$ErrorActionPreference = "Stop"

function Bootstrap-EnvFile($example, $target) {
    if (Test-Path $target) {
        Write-Host "  [skip] $target already exists" -ForegroundColor DarkGray
        return
    }
    if (-not (Test-Path $example)) {
        Write-Host "  [warn] $example not found — nothing to copy" -ForegroundColor Yellow
        return
    }
    Copy-Item $example $target
    Write-Host "  [made] $target (from $example)" -ForegroundColor Green
}

Write-Host "SecureFlow Docker setup" -ForegroundColor Cyan
Write-Host "------------------------"

Bootstrap-EnvFile "backend\.env.docker.example"     "backend\.env.docker"
Bootstrap-EnvFile "secureflow\.env.docker.example"  "secureflow\.env.docker"

Write-Host ""
Write-Host "Next: open the files below and fill in real values (get them from" -ForegroundColor Cyan
Write-Host "whoever manages the team's Supabase project — never commit these):" -ForegroundColor Cyan
Write-Host "  - backend\.env.docker      (SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL required)"
Write-Host "  - secureflow\.env.docker   (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY required)"
Write-Host ""
Write-Host "Then run:  docker compose up --build" -ForegroundColor Cyan
