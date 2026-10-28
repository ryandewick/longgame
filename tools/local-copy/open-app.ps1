# What the Long Game desktop shortcut runs: Long Game in a window of its own, with no console window.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File tools\local-copy\open-app.ps1
#
# A console shows only when there is something to watch or read: installing and building after the code has
# changed, or a problem Long Game.bat explains in words (no Node, an old Node, a failed build). Then the server
# starts with no window, Long Game opens in an app window, and closing that window stops the server.

# Errors are left to go on (the default), not stop: Windows PowerShell reports anything a program writes to its
# error output as an error, so stopping on errors would end this script whenever the check below fails, before the
# batch file could say why.
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $root
$launcher = Join-Path $root 'tools\local-copy\launch.ts'
$batch = Join-Path $root 'Long Game.bat'

# The launcher's check exits 0 when Long Game can start straight away. Anything else (an install or a build to do,
# no Node, a Node too old to run the launcher) is left to the batch file, in a window that can be read.
$ready = $false
if (Get-Command node -ErrorAction SilentlyContinue) {
  & node $launcher --check *> $null
  $ready = ($LASTEXITCODE -eq 0)
}
if (-not $ready) {
  $prepare = Start-Process -FilePath $batch -ArgumentList 'prepare' -WorkingDirectory $root -Wait -PassThru
  if ($prepare.ExitCode -ne 0) { exit 1 }
}

Start-Process -FilePath 'node' -ArgumentList "`"$launcher`"", '--app-window' -WorkingDirectory $root -WindowStyle Hidden
