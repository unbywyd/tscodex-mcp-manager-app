# Kill MCP Manager and related processes before build
Write-Host "Killing MCP Manager processes..."

# Function to kill process tree
function Kill-ProcessTree {
    param([int]$ProcessId)
    Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ProcessId } | ForEach-Object {
        Kill-ProcessTree -ProcessId $_.ProcessId
    }
    try {
        Stop-Process -Id $ProcessId -Force -ErrorAction Stop
        Write-Host "Killed process: PID $ProcessId"
    } catch {
        Write-Host "Could not kill process: PID $ProcessId"
    }
}

# Kill MCP Manager processes (including child processes)
Get-Process | Where-Object {
    $_.Path -like "*mcp-manager*" -or 
    $_.ProcessName -eq "MCP Manager"
} | ForEach-Object {
    Write-Host "Killing process tree: $($_.ProcessName) (PID: $($_.Id))"
    Kill-ProcessTree -ProcessId $_.Id
}

# Kill rcedit processes
Get-Process | Where-Object {
    $_.ProcessName -like "*rcedit*"
} | ForEach-Object {
    Write-Host "Killing process: $($_.ProcessName) (PID: $($_.Id))"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

# Kill electron processes related to mcp-manager
Get-Process | Where-Object {
    $_.ProcessName -like "*electron*" -and $_.Path -like "*mcp-manager*"
} | ForEach-Object {
    Write-Host "Killing electron process: $($_.ProcessName) (PID: $($_.Id))"
    Kill-ProcessTree -ProcessId $_.Id
}

# Wait for processes to fully terminate
Start-Sleep -Seconds 2

# Remove locked files and directories
$exePath = "release\win-unpacked\MCP Manager.exe"
$unpackedDir = "release\win-unpacked"
$iconDir = "release\.icon-ico"

# First, try to remove entire win-unpacked directory (cleanest approach)
if (Test-Path $unpackedDir) {
    try {
        # Remove read-only attribute from all files
        Get-ChildItem -Path $unpackedDir -Recurse -Force | ForEach-Object {
            $_.IsReadOnly = $false
        }
        Remove-Item $unpackedDir -Recurse -Force -ErrorAction Stop
        Write-Host "Removed entire win-unpacked directory"
    } catch {
        Write-Host "Could not remove win-unpacked directory, trying individual files..."
        # Fallback: try to remove EXE file individually
        if (Test-Path $exePath) {
            try {
                $file = Get-Item $exePath -Force
                $file.IsReadOnly = $false
                Remove-Item $exePath -Force -ErrorAction Stop
                Write-Host "Removed locked EXE file"
            } catch {
                Write-Host "Warning: Could not remove EXE file (may still be locked by another process)"
                Write-Host "You may need to close file explorer or other programs accessing this file"
            }
        }
    }
}

# Remove icon directory
if (Test-Path $iconDir) {
    try {
        Remove-Item $iconDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "Removed icon directory"
    } catch {
        Write-Host "Could not remove icon directory"
    }
}

# Final wait for system to release file handles
Start-Sleep -Seconds 2

# Check if EXE still exists (should be removed)
if (Test-Path $exePath) {
    Write-Host "Warning: EXE file still exists after cleanup"
    Write-Host "You may need to manually close programs accessing this file"
    Write-Host "Or restart your computer if the file is locked by system processes"
} else {
    Write-Host "Cleanup successful - EXE file removed"
}

Write-Host "Done killing processes."

