Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

pnpm --filter @apps/api prisma:migrate

if (-not (Test-Path '.first-run-done')) {
    pnpm --filter @apps/api prisma:seed
    New-Item -Path '.first-run-done' -ItemType File | Out-Null
    Write-Host 'Database seeded (created .first-run-done marker).'
} else {
    Write-Host 'Seed skipped; .first-run-done already exists.'
}
