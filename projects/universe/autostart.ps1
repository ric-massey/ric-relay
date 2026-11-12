# autostart.ps1 -- start the world that is left running when Windows starts.
#
#   powershell -ExecutionPolicy Bypass -File autostart.ps1 install
#   powershell -ExecutionPolicy Bypass -File autostart.ps1 remove
#   powershell -ExecutionPolicy Bypass -File autostart.ps1 status
#
# It puts ONE shortcut in this user's Startup folder, pointing at run-world.cmd,
# opened minimised. Nothing else: no service, no scheduled task, nothing that
# needs an administrator. Removing the shortcut (or `remove`) undoes all of it.
# The world itself is not touched either way -- it lives in runs\eternal\.
param([Parameter(Position = 0)][ValidateSet("install", "remove", "status")][string]$Action = "status")

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$link = Join-Path ([Environment]::GetFolderPath("Startup")) "Universe world.lnk"

switch ($Action) {
  "install" {
    $shell = New-Object -ComObject WScript.Shell
    $s = $shell.CreateShortcut($link)
    $s.TargetPath = Join-Path $here "run-world.cmd"
    $s.WorkingDirectory = $here
    $s.WindowStyle = 7            # minimised
    $s.Description = "The universe project's long-running World (projects/universe/run-world.cmd)"
    $s.Save()
    Write-Output "Installed: $link"
    Write-Output "The world will start, minimised, the next time you sign in to Windows."
  }
  "remove" {
    if (Test-Path $link) { Remove-Item $link -Confirm:$false; Write-Output "Removed: $link" }
    else { Write-Output "Nothing to remove: $link is not there." }
  }
  "status" {
    if (Test-Path $link) { Write-Output "Installed: $link" } else { Write-Output "Not installed." }
  }
}
