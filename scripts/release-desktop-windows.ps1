param(
  [string]$Brand = $(if ($env:APP_NAME) { $env:APP_NAME } elseif ($env:ICLAW_PORTAL_APP_NAME) { $env:ICLAW_PORTAL_APP_NAME } else { 'licaiclaw' }),
  [string]$ReleaseVersion = '',
  [string[]]$Channels = @('dev', 'prod'),
  [string[]]$Targets = @('x86_64-pc-windows-msvc', 'aarch64-pc-windows-msvc'),
  [int]$KeepVersions = $(if ($env:ICLAW_KEEP_VERSIONS) { [int]$env:ICLAW_KEEP_VERSIONS } else { 2 }),
  [switch]$SkipUnsupportedTargets,
  [switch]$SkipBuild,
  [switch]$SkipPublish,
  [switch]$SkipHomeDeploy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $PSScriptRoot
$DesktopDir = Join-Path $RootDir 'apps\desktop'
$ReleaseDir = Join-Path $RootDir 'dist\releases'
$TauriTargetDir = Join-Path $DesktopDir 'src-tauri\target'
$BackupEnvPath = Join-Path $RootDir '.env.codex.backup'
$env:APP_NAME = $Brand
$env:ICLAW_PORTAL_APP_NAME = $Brand
$env:ICLAW_BRAND = $Brand

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter()][string[]]$Arguments = @(),
    [Parameter()][hashtable]$Environment = @{},
    [Parameter()][string]$WorkingDirectory = $RootDir
  )

  $argumentList = @($Arguments)
  Write-Host "> $FilePath $($argumentList -join ' ')"

  $startProcessSupportsEnvironment = (Get-Command Start-Process).Parameters.ContainsKey('Environment')
  if ($startProcessSupportsEnvironment) {
    $mergedEnv = @{}
    Get-ChildItem Env: | ForEach-Object {
      $mergedEnv[$_.Name] = $_.Value
    }
    foreach ($entry in $Environment.GetEnumerator()) {
      $mergedEnv[$entry.Key] = [string]$entry.Value
    }

    $process = Start-Process -FilePath $FilePath -ArgumentList $argumentList -WorkingDirectory $WorkingDirectory -NoNewWindow -Wait -PassThru -Environment $mergedEnv
    if ($process.ExitCode -ne 0) {
      throw "Command failed with exit code $($process.ExitCode): $FilePath $($argumentList -join ' ')"
    }
    return
  }

  $previousValues = @{}
  foreach ($entry in $Environment.GetEnumerator()) {
    $name = [string]$entry.Key
    if (Test-Path "Env:$name") {
      $previousValues[$name] = (Get-Item "Env:$name").Value
    } else {
      $previousValues[$name] = $null
    }
    Set-Item "Env:$name" -Value ([string]$entry.Value)
  }

  $originalLocation = Get-Location
  try {
    Set-Location -LiteralPath $WorkingDirectory
    & $FilePath @argumentList
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($argumentList -join ' ')"
    }
  }
  finally {
    Set-Location -LiteralPath $originalLocation
    foreach ($entry in $previousValues.GetEnumerator()) {
      if ($null -eq $entry.Value) {
        Remove-Item "Env:$($entry.Key)" -ErrorAction SilentlyContinue
      } else {
        Set-Item "Env:$($entry.Key)" -Value $entry.Value
      }
    }
  }
}

function Get-CommandPath {
  param([Parameter(Mandatory = $true)][string]$Name)
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "Required command not found: $Name"
  }
  return $command.Source
}

function Get-PnpmCommand {
  $corepack = Get-Command corepack.cmd -ErrorAction SilentlyContinue
  if (-not $corepack) {
    $corepack = Get-Command corepack -ErrorAction SilentlyContinue
  }
  if (-not $corepack) {
    throw 'corepack is required but was not found'
  }
  return $corepack.Source
}

function Get-JsonValue {
  param(
    [Parameter(Mandatory = $true)][string]$ScriptPath,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )
  $output = & $ScriptPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to read JSON-backed value from $ScriptPath"
  }
  return ($output | Select-Object -Last 1).Trim()
}

function Normalize-EnvName {
  param([Parameter(Mandatory = $true)][string]$EnvName)
  switch ($EnvName.Trim().ToLowerInvariant()) {
    'dev' { return 'dev' }
    'development' { return 'dev' }
    'local' { return 'dev' }
    'test' { return 'test' }
    'testing' { return 'test' }
    'staging' { return 'test' }
    'prod' { return 'prod' }
    'production' { return 'prod' }
    'release' { return 'prod' }
    default { throw "Unsupported environment: $EnvName" }
  }
}

function Get-PublicAppVersion {
  param([Parameter(Mandatory = $true)][string]$Version)
  $normalized = $Version.Trim()
  if (-not $normalized) {
    throw 'Version cannot be empty'
  }
  return ($normalized -split '\+', 2)[0]
}

function Get-NormalizedReleaseVersion {
  param(
    [Parameter(Mandatory = $true)][string]$BaseVersion,
    [Parameter()][string]$RequestedReleaseVersion = ''
  )

  $normalizedBaseVersion = $BaseVersion.Trim()
  if (-not $normalizedBaseVersion) {
    throw 'BaseVersion cannot be empty'
  }

  $candidate = $RequestedReleaseVersion.Trim()
  if (-not $candidate) {
    return "$normalizedBaseVersion.$(Get-Date -Format 'yyyyMMddHHmm')"
  }

  $candidate = [regex]::Replace($candidate, '\+[^.]+', '')
  if ($candidate -match '^\d+\.\d+\.\d+$') {
    return "$candidate.$(Get-Date -Format 'yyyyMMddHHmm')"
  }
  if ($candidate -notmatch '^\d+\.\d+\.\d+\.\d+$') {
    throw "Unsupported ReleaseVersion format: $RequestedReleaseVersion. Expected <baseVersion>.<datetime>."
  }
  return $candidate
}

function Resolve-UploadPrefix {
  param([Parameter(Mandatory = $true)][string]$PublicBaseUrl)
  $normalized = $PublicBaseUrl.Trim()
  if (-not $normalized) {
    return ''
  }

  try {
    $uri = [System.Uri]$normalized
  } catch {
    return ''
  }

  return $uri.AbsolutePath.Trim('/')
}

function Read-EnvFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  $values = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $values
  }

  foreach ($rawLine in Get-Content -LiteralPath $Path) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith('#')) {
      continue
    }
    $separatorIndex = $line.IndexOf('=')
    if ($separatorIndex -lt 1) {
      continue
    }

    $key = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1)
    if ($value.Length -ge 2) {
      $first = $value.Substring(0, 1)
      $last = $value.Substring($value.Length - 1, 1)
      if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }
    $values[$key] = $value
  }
  return $values
}

function Set-PreparedEnvFile {
  param([Parameter(Mandatory = $true)][string]$EnvName)
  $normalized = Normalize-EnvName $EnvName
  $sourcePath = Join-Path $RootDir ".env.$normalized"
  $targetPath = Join-Path $RootDir '.env'
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Missing source env file: $sourcePath"
  }

  if (-not (Test-Path -LiteralPath $BackupEnvPath) -and (Test-Path -LiteralPath $targetPath)) {
    Copy-Item -LiteralPath $targetPath -Destination $BackupEnvPath -Force
  }

  Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
  foreach ($overridePath in @((Join-Path $RootDir '.env.local'), (Join-Path $RootDir ".env.$normalized.local"))) {
    if (Test-Path -LiteralPath $overridePath) {
      Add-Content -LiteralPath $targetPath -Value "`n# merged from $(Split-Path -Leaf $overridePath)"
      Get-Content -LiteralPath $overridePath | Add-Content -LiteralPath $targetPath
    }
  }

  $envValues = @{}
  foreach ($path in @($sourcePath, (Join-Path $RootDir '.env.local'), (Join-Path $RootDir ".env.$normalized.local"))) {
    foreach ($entry in (Read-EnvFile -Path $path).GetEnumerator()) {
      $envValues[$entry.Key] = $entry.Value
    }
  }
  $envValues['NODE_ENV'] = $normalized
  $envValues['ICLAW_ENV_NAME'] = $normalized
  $envValues['APP_NAME'] = $Brand
  $envValues['ICLAW_PORTAL_APP_NAME'] = $Brand
  $envValues['ICLAW_BRAND'] = $Brand
  $envValues['ICLAW_RELEASE_VERSION'] = $ReleaseVersion
  $envValues['ICLAW_DESKTOP_RELEASE_VERSION'] = $ReleaseVersion
  return $envValues
}

function Restore-EnvFile {
  $targetPath = Join-Path $RootDir '.env'
  if (Test-Path -LiteralPath $BackupEnvPath) {
    Copy-Item -LiteralPath $BackupEnvPath -Destination $targetPath -Force
    Remove-Item -LiteralPath $BackupEnvPath -Force
    return
  }
  if (Test-Path -LiteralPath $targetPath) {
    Remove-Item -LiteralPath $targetPath -Force
  }
}

function Get-ArchLabel {
  param([Parameter(Mandatory = $true)][string]$Target)
  switch ($Target) {
    'x86_64-pc-windows-msvc' { return 'x64' }
    'aarch64-pc-windows-msvc' { return 'aarch64' }
    default { throw "Unsupported Windows target: $Target" }
  }
}

function Test-NativeUpdaterEnabled {
  if (-not $env:ICLAW_DESKTOP_ENABLE_NATIVE_UPDATER) {
    return $false
  }
  return $env:ICLAW_DESKTOP_ENABLE_NATIVE_UPDATER.Trim().ToLowerInvariant() -in @('1', 'true', 'yes')
}

function Should-SkipUnsupportedTargetFailure {
  param(
    [Parameter(Mandatory = $true)][string]$Target,
    [Parameter(Mandatory = $true)][string]$ErrorText
  )

  if (-not $SkipUnsupportedTargets) {
    return $false
  }

  $normalizedTarget = $Target.Trim().ToLowerInvariant()
  if ($normalizedTarget -ne 'aarch64-pc-windows-msvc') {
    return $false
  }

  $normalizedError = $ErrorText.ToLowerInvariant()
  $skipMarkers = @(
    'openclaw runtime artifact target does not match',
    'runtime artifact sha256 mismatch',
    'expected windows installer not found',
    'windows bundle directory not found',
    'failed to download runtime artifact for verification',
    'invalid openclaw runtime bootstrap config',
    'missing openclaw runtime bootstrap config',
    'no windows installer found under'
  )

  foreach ($marker in $skipMarkers) {
    if ($normalizedError.Contains($marker)) {
      return $true
    }
  }

  return $false
}

function Find-LatestMatch {
  param(
    [Parameter(Mandatory = $true)][string]$Directory,
    [Parameter(Mandatory = $true)][string[]]$Patterns
  )

  foreach ($pattern in $Patterns) {
    $match = Get-ChildItem -LiteralPath $Directory -File -Filter $pattern -ErrorAction SilentlyContinue |
      Sort-Object Name |
      Select-Object -Last 1
    if ($match) {
      return $match
    }
  }
  return $null
}

function Find-LatestFileByExtensions {
  param(
    [Parameter(Mandatory = $true)][string]$Directory,
    [Parameter(Mandatory = $true)][string[]]$Extensions
  )

  $normalizedExtensions = @($Extensions | ForEach-Object { $_.Trim().ToLowerInvariant() })
  return Get-ChildItem -LiteralPath $Directory -File -ErrorAction SilentlyContinue |
    Where-Object { $normalizedExtensions -contains $_.Extension.Trim().ToLowerInvariant() } |
    Sort-Object LastWriteTime, Name |
    Select-Object -Last 1
}

function Save-WindowsArtifacts {
  param(
    [Parameter(Mandatory = $true)][string]$Target,
    [Parameter(Mandatory = $true)][string]$Channel,
    [Parameter(Mandatory = $true)][string]$AppVersion,
    [Parameter(Mandatory = $true)][string]$ResolvedReleaseVersion,
    [Parameter(Mandatory = $true)][string]$ArtifactBaseName
  )

  $archLabel = Get-ArchLabel -Target $Target
  $installerDir = Join-Path $TauriTargetDir "$Target\release\bundle\nsis"
  if (-not (Test-Path -LiteralPath $installerDir)) {
    throw "Windows bundle directory not found: $installerDir"
  }

  if ($archLabel -eq 'aarch64') {
    $installer = Find-LatestMatch -Directory $installerDir -Patterns @(
      "*$ResolvedReleaseVersion*aarch64*.exe",
      "*$ResolvedReleaseVersion*arm64*.exe",
      "*$AppVersion*aarch64*.exe",
      "*$AppVersion*arm64*.exe"
    )
    $updater = Find-LatestMatch -Directory $installerDir -Patterns @(
      "*$ResolvedReleaseVersion*aarch64*.nsis.zip",
      "*$ResolvedReleaseVersion*arm64*.nsis.zip",
      "*$AppVersion*aarch64*.nsis.zip",
      "*$AppVersion*arm64*.nsis.zip"
    )
  } else {
    $installer = Find-LatestMatch -Directory $installerDir -Patterns @(
      "*$ResolvedReleaseVersion*x64*.exe",
      "*$AppVersion*x64*.exe"
    )
    $updater = Find-LatestMatch -Directory $installerDir -Patterns @(
      "*$ResolvedReleaseVersion*x64*.nsis.zip",
      "*$AppVersion*x64*.nsis.zip"
    )
  }

  if (-not $installer) {
    $installer = Find-LatestFileByExtensions -Directory $installerDir -Extensions @('.exe')
  }

  if (-not $updater) {
    $updater = Find-LatestFileByExtensions -Directory $installerDir -Extensions @('.zip')
  }

  if (-not $installer) {
    throw "Expected Windows installer not found under: $installerDir"
  }

  New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null
  $installerOut = Join-Path $ReleaseDir "${ArtifactBaseName}_${ResolvedReleaseVersion}_${archLabel}_${Channel}.exe"
  Copy-Item -LiteralPath $installer.FullName -Destination $installerOut -Force
  Write-Host "saved: $installerOut"

  if ((Test-NativeUpdaterEnabled) -and $updater) {
    $signaturePath = "$($updater.FullName).sig"
    if (Test-Path -LiteralPath $signaturePath) {
      $updaterOut = Join-Path $ReleaseDir "${ArtifactBaseName}_${ResolvedReleaseVersion}_${archLabel}_${Channel}.nsis.zip"
      Copy-Item -LiteralPath $updater.FullName -Destination $updaterOut -Force
      Copy-Item -LiteralPath $signaturePath -Destination "$updaterOut.sig" -Force
      Write-Host "saved: $updaterOut"
      Write-Host "saved: $updaterOut.sig"
    }
  }
}

function Copy-MatchingFilesToRemote {
  param(
    [Parameter(Mandatory = $true)][string]$LocalDir,
    [Parameter(Mandatory = $true)][string]$RemoteTarget
  )

  $files = Get-ChildItem -LiteralPath $LocalDir -Force
  foreach ($file in $files) {
    Invoke-Checked -FilePath (Get-CommandPath -Name 'scp') -Arguments @('-q', '-r', $file.FullName, $RemoteTarget)
  }
}

function Build-HomeWebProd {
  param([Parameter(Mandatory = $true)][hashtable]$Environment)
  $pnpm = Get-PnpmCommand
  Invoke-Checked -FilePath $pnpm -Arguments @('pnpm', '--dir', 'home-web', 'build') -Environment $Environment -WorkingDirectory $RootDir
}

function Publish-Channel {
  param(
    [Parameter(Mandatory = $true)][string]$Channel,
    [Parameter(Mandatory = $true)][string]$ArtifactBaseName
  )

  $mc = Get-CommandPath -Name 'mc'
  $channelValue = Normalize-EnvName $Channel
  if ($channelValue -eq 'dev') {
    $alias = if ($env:ICLAW_MINIO_DEV_ALIAS) { $env:ICLAW_MINIO_DEV_ALIAS } else { 'local' }
    $bucket = if ($env:ICLAW_MINIO_DEV_BUCKET) { $env:ICLAW_MINIO_DEV_BUCKET } else { Get-JsonValue -ScriptPath (Get-CommandPath -Name 'node') -Arguments @("$RootDir\scripts\read-brand-value.mjs", '--brand', $Brand, 'distribution.downloads.dev.bucket') }
    $publicBaseUrl = Get-JsonValue -ScriptPath (Get-CommandPath -Name 'node') -Arguments @("$RootDir\scripts\read-brand-value.mjs", '--brand', $Brand, 'distribution.downloads.dev.publicBaseUrl')
  } elseif ($channelValue -eq 'test') {
    $alias = if ($env:ICLAW_MINIO_TEST_ALIAS) { $env:ICLAW_MINIO_TEST_ALIAS } else { 'local' }
    $bucket = if ($env:ICLAW_MINIO_TEST_BUCKET) { $env:ICLAW_MINIO_TEST_BUCKET } else { Get-JsonValue -ScriptPath (Get-CommandPath -Name 'node') -Arguments @("$RootDir\scripts\read-brand-value.mjs", '--brand', $Brand, 'distribution.downloads.test.bucket') }
    $publicBaseUrl = Get-JsonValue -ScriptPath (Get-CommandPath -Name 'node') -Arguments @("$RootDir\scripts\read-brand-value.mjs", '--brand', $Brand, 'distribution.downloads.test.publicBaseUrl')
  } else {
    $alias = if ($env:ICLAW_MINIO_PROD_ALIAS) { $env:ICLAW_MINIO_PROD_ALIAS } else { 'remoteprod' }
    $bucket = if ($env:ICLAW_MINIO_PROD_BUCKET) { $env:ICLAW_MINIO_PROD_BUCKET } else { Get-JsonValue -ScriptPath (Get-CommandPath -Name 'node') -Arguments @("$RootDir\scripts\read-brand-value.mjs", '--brand', $Brand, 'distribution.downloads.prod.bucket') }
    $publicBaseUrl = Get-JsonValue -ScriptPath (Get-CommandPath -Name 'node') -Arguments @("$RootDir\scripts\read-brand-value.mjs", '--brand', $Brand, 'distribution.downloads.prod.publicBaseUrl')
  }
  $uploadPrefix = Resolve-UploadPrefix -PublicBaseUrl $publicBaseUrl
  $uploadLatestOnly = -not ($env:ICLAW_UPLOAD_ALL_RELEASES -and $env:ICLAW_UPLOAD_ALL_RELEASES.Trim() -match '^(1|true|yes)$')

  $patterns = @(
    "${ArtifactBaseName}_*_${channelValue}.exe",
    "latest-$channelValue*.json"
  )
  if (Test-NativeUpdaterEnabled) {
    $patterns += @(
      "${ArtifactBaseName}_*_${channelValue}.nsis.zip",
      "${ArtifactBaseName}_*_${channelValue}.nsis.zip.sig"
    )
  }

  $files = @(
    foreach ($pattern in $patterns) {
      Get-ChildItem -LiteralPath $ReleaseDir -File -Filter $pattern -ErrorAction SilentlyContinue
    }
  ) | Sort-Object FullName -Unique

  if (-not $files) {
    throw "No release files found for channel=$channelValue under $ReleaseDir"
  }

  Invoke-Checked -FilePath $mc -Arguments @('mb', '--ignore-existing', "$alias/$bucket")
  $uploadRoot = "$alias/$bucket"
  if ($uploadPrefix) {
    $uploadRoot = "$uploadRoot/$uploadPrefix"
    Invoke-Checked -FilePath $mc -Arguments @('mb', '--ignore-existing', $uploadRoot)
  }
  $manifestsByTarget = @{}
  foreach ($file in $files) {
    $manifestMatch = [regex]::Match($file.Name, '^latest-(?<channel>dev|prod)-(?<platform>[^-]+)-(?<arch>[^.]+)\.json$')
    if ($manifestMatch.Success) {
      $targetKey = "$($manifestMatch.Groups['platform'].Value)/$($manifestMatch.Groups['arch'].Value)"
      if (-not $manifestsByTarget.ContainsKey($targetKey)) {
        $manifestsByTarget[$targetKey] = New-Object System.Collections.Generic.List[object]
      }
      $null = $manifestsByTarget[$targetKey].Add($file)
    }
    if ($file.Name -match '^latest-(?<channel>dev|prod)\.json$') {
      Invoke-Checked -FilePath $mc -Arguments @('cp', $file.FullName, "$uploadRoot/")
    }
  }

  $installers = Get-ChildItem -LiteralPath $ReleaseDir -File -Filter "${ArtifactBaseName}_*_${channelValue}.exe" -ErrorAction SilentlyContinue |
    Sort-Object Name
  $updaters = @()
  if (Test-NativeUpdaterEnabled) {
    $updaters = Get-ChildItem -LiteralPath $ReleaseDir -File -Filter "${ArtifactBaseName}_*_${channelValue}.nsis.zip*" -ErrorAction SilentlyContinue |
      Sort-Object Name
  }
  if ($uploadLatestOnly) {
    $installers = @($installers | Where-Object { $_.Name -like "${ArtifactBaseName}_${ReleaseVersion}_*_${channelValue}.exe" })
    if (Test-NativeUpdaterEnabled) {
      $updaters = @($updaters | Where-Object { $_.Name -like "${ArtifactBaseName}_${ReleaseVersion}_*_${channelValue}.nsis.zip*" })
    }
  }
  $installerGroups = @{}
  foreach ($installer in $installers) {
    $isArm = $installer.Name -match '_(aarch64|arm64)_'
    $archLabel = if ($isArm) { 'aarch64' } else { 'x64' }
    $targetKey = "windows/$archLabel"
    if (-not $installerGroups.ContainsKey($targetKey)) {
      $installerGroups[$targetKey] = New-Object System.Collections.Generic.List[object]
    }
    $null = $installerGroups[$targetKey].Add($installer)
  }

  foreach ($entry in $installerGroups.GetEnumerator()) {
    $targetKey = $entry.Key
    $targetDir = "$uploadRoot/$targetKey"
    Invoke-Checked -FilePath $mc -Arguments @('mb', '--ignore-existing', $targetDir)
    foreach ($installer in $entry.Value) {
      Invoke-Checked -FilePath $mc -Arguments @('cp', $installer.FullName, "$targetDir/")
    }

    if ($manifestsByTarget.ContainsKey($targetKey)) {
      foreach ($manifest in $manifestsByTarget[$targetKey]) {
        Invoke-Checked -FilePath $mc -Arguments @('cp', $manifest.FullName, "$targetDir/")
      }
    }

    foreach ($updater in $updaters) {
      $updaterArch = if ($updater.Name -match '_(aarch64|arm64)_') { 'aarch64' } else { 'x64' }
      if ("windows/$updaterArch" -eq $targetKey) {
        Invoke-Checked -FilePath $mc -Arguments @('cp', $updater.FullName, "$targetDir/")
      }
    }
  }
  Invoke-Checked -FilePath $mc -Arguments @('anonymous', 'set', 'download', "$alias/$bucket")

  if ($KeepVersions -gt 0 -and $installers.Count -gt $KeepVersions) {
    $installers | Select-Object -First ($installers.Count - $KeepVersions) | ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Force
      Write-Host "[local-prune] removed: $($_.Name)"
    }
  }
}

try {
  $node = Get-CommandPath -Name 'node'
  $artifactBaseName = Get-JsonValue -ScriptPath $node -Arguments @("$RootDir\scripts\read-brand-value.mjs", '--brand', $Brand, 'distribution.artifactBaseName')
  $packageJson = Get-Content -LiteralPath (Join-Path $RootDir 'package.json') -Raw | ConvertFrom-Json
  $appVersion = [string]$packageJson.version
  $publicAppVersion = Get-PublicAppVersion -Version $appVersion
  $normalizedChannels = @($Channels | ForEach-Object { Normalize-EnvName $_ })
  $ReleaseVersion = Get-NormalizedReleaseVersion -BaseVersion $publicAppVersion -RequestedReleaseVersion $ReleaseVersion

  if (-not $SkipBuild) {
    foreach ($normalizedChannel in $normalizedChannels) {
      $buildEnv = Set-PreparedEnvFile -EnvName $normalizedChannel
      foreach ($target in $Targets) {
        Write-Host "==> building Windows desktop: brand=$Brand channel=$normalizedChannel target=$target"
        try {
          Invoke-Checked -FilePath $node -Arguments @("$RootDir\scripts\build-desktop-package.mjs", '--brand', $Brand, '--target', $target) -Environment $buildEnv -WorkingDirectory $RootDir
          Save-WindowsArtifacts -Target $target -Channel $normalizedChannel -AppVersion $appVersion -ResolvedReleaseVersion $ReleaseVersion -ArtifactBaseName $artifactBaseName
        }
        catch {
          $errorText = $_ | Out-String
          if (Should-SkipUnsupportedTargetFailure -Target $target -ErrorText $errorText) {
            Write-Warning "Skipping unsupported Windows target for brand=$Brand channel=$normalizedChannel target=$target"
            Write-Warning $errorText.Trim()
            continue
          }
          throw
        }
      }
      Invoke-Checked -FilePath $node -Arguments @("$RootDir\scripts\generate-desktop-release-manifests.mjs", '--brand', $Brand, '--channel', $normalizedChannel, '--release-dir', $ReleaseDir, '--version', $publicAppVersion) -Environment $buildEnv -WorkingDirectory $RootDir
    }
  }

  if (-not $SkipPublish) {
    foreach ($normalizedChannel in $normalizedChannels) {
      Publish-Channel -Channel $normalizedChannel -ArtifactBaseName $artifactBaseName
    }
  }

  if (-not $SkipHomeDeploy -and ($normalizedChannels -contains 'prod')) {
    $prodEnv = Set-PreparedEnvFile -EnvName 'prod'
    Build-HomeWebProd -Environment $prodEnv

    $nginxHost = if ($env:ICLAW_NGINX_HOST) { $env:ICLAW_NGINX_HOST } else { '113.44.132.75' }
    $nginxUser = if ($env:ICLAW_NGINX_USER) { $env:ICLAW_NGINX_USER } else { 'root' }
    $nginxPath = if ($env:ICLAW_NGINX_PATH) { $env:ICLAW_NGINX_PATH } else { Get-JsonValue -ScriptPath $node -Arguments @("$RootDir\scripts\read-brand-value.mjs", '--brand', $Brand, 'distribution.home.nginxPath') }

    $ssh = Get-CommandPath -Name 'ssh'
    Invoke-Checked -FilePath $ssh -Arguments @("$nginxUser@$nginxHost", "mkdir -p '$nginxPath' && find '$nginxPath' -mindepth 1 -maxdepth 1 -exec rm -rf {} +")
    Copy-MatchingFilesToRemote -LocalDir (Join-Path $RootDir 'home-web\dist') -RemoteTarget "${nginxUser}@${nginxHost}:${nginxPath}/"
  }

  Write-Host "Windows desktop release completed for brand=$Brand version=$ReleaseVersion"
}
finally {
  Restore-EnvFile
}
