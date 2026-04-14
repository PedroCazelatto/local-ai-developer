param([string]$Action, [string]$Project)

$VENV_PYTHON = ".\.venv\Scripts\python.exe"

switch ($Action) {
    "start" {
        if (-not $Project) {
            Write-Host "❌ Error: Project name required. Example: .\run.ps1 start hello-world" -ForegroundColor Red
            return
        }
        try {
            Write-Host "🚀 Starting infrastructure..." -ForegroundColor Cyan
            docker compose up -d
            Write-Host "🧠 Initializing Local AI Architect..." -ForegroundColor Green
            & $VENV_PYTHON main.py $Project
        }
        finally {
            Write-Host "🛑 Shutting down infrastructure..." -ForegroundColor Yellow
            docker compose stop
        }
    }
    "run" {
        if (-not $Project) {
            Write-Host "❌ Error: Project name required. Example: .\run.ps1 run hello-world" -ForegroundColor Red
        } else {
            & $VENV_PYTHON main.py $Project
        }
    }
    "up" { docker compose up -d }
    "stop" { docker compose stop }
    "down" { docker compose down }
    "install" { & $VENV_PYTHON -m pip install -r requirements.txt }
    default {
        Write-Host "Available Commands:" -ForegroundColor Cyan
        Write-Host "  start <project>   : Starts Docker and runs the AI (Recommended)"
        Write-Host "  run <project>     : Runs the AI without starting Docker"
        Write-Host "  up | stop | down  : Manage Docker containers"
        Write-Host "  install           : Install Python dependencies"
    }
}
