param([string]$DotnetPath = 'dotnet')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dist = Join-Path $root 'dist'
$stage = Join-Path $dist 'package'
$plugin = Join-Path $stage 'BotRandomizer'

function Invoke-Dotnet {
    & $DotnetPath @args
    if ($LASTEXITCODE -ne 0) { throw "dotnet failed: $args" }
}

Invoke-Dotnet restore (Join-Path $root 'BotRandomizer.csproj') --locked-mode
Invoke-Dotnet run --project (Join-Path $root 'tests/BotRandomizer.Tests.csproj') -c Release -- $root
if (Test-Path -LiteralPath $stage) {
    $resolved = (Resolve-Path -LiteralPath $stage).Path
    if ($resolved -ne [IO.Path]::GetFullPath($stage)) { throw 'Unexpected package path' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
Invoke-Dotnet publish (Join-Path $root 'BotRandomizer.csproj') -c Release --no-restore -o $plugin '-p:DebugType=None' '-p:DebugSymbols=false' "-p:PathMap=$root=/_/BotRandomizer"
foreach ($file in @('BotRandomizer.dll', 'BotRandomizer.deps.json', 'cosmetic_catalog.json', 'charm_placements.json', 'gamedata/botrandomizer.json')) {
    if (!(Test-Path -LiteralPath (Join-Path $plugin $file))) { throw "Missing package file: $file" }
}
Copy-Item -LiteralPath (Join-Path $root 'LICENSE') -Destination $plugin
$archive = Join-Path $dist 'BotRandomizer.zip'
Compress-Archive -Path $plugin -DestinationPath $archive -Force
$hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  BotRandomizer.zip" | Set-Content -LiteralPath "$archive.sha256" -Encoding utf8NoBOM
Write-Output "Built $archive"
