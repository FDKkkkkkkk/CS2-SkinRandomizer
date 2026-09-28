param([string]$DotnetPath = 'dotnet')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Push-Location (Join-Path $PSScriptRoot 'catalog')
try {
    $metadata = npm view '@ianlucas/cs2-lib@latest' version gitHead --json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or $metadata.version -notmatch '^\d+\.\d+\.\d+$' -or $metadata.gitHead -notmatch '^[a-f0-9]{40}$') {
        throw 'Expected a stable cs2-lib release with a source commit'
    }
    npm install --save-exact --ignore-scripts --no-audit --no-fund "@ianlucas/cs2-lib@$($metadata.version)"
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
    [ordered]@{ package = '@ianlucas/cs2-lib'; version = $metadata.version; commit = $metadata.gitHead } |
        ConvertTo-Json | Set-Content source.json -Encoding utf8NoBOM
    foreach ($command in @('generate', 'check', 'test')) {
        npm run $command
        if ($LASTEXITCODE -ne 0) { throw "Catalog $command failed" }
    }
    & $DotnetPath run --project (Join-Path $root 'tests/BotRandomizer.Tests.csproj') -c Release -- $root
    if ($LASTEXITCODE -ne 0) { throw 'Runtime catalog validation failed' }
} finally { Pop-Location }
