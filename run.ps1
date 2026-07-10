param([string]$Action, [string]$Project)

# Thin wrapper over npm / node / docker compose. It contains no orchestration logic of
# its own — all real behavior lives in src/ (TypeScript). Verbs: install | start <project> | stop.
# See tasks/foundation/01-repo-skeleton-and-toolchain.md.

switch ($Action) {
    "install" {
        Write-Host "Installing Node dependencies..." -ForegroundColor Green
        npm install
        # The sandbox uses a stock image (node:24-slim, see docker-compose.yml), so pull it
        # rather than building — node/npm ship in the image for project work.
        Write-Host "Pulling sandbox image..." -ForegroundColor Cyan
        docker compose pull
    }
    "start" {
        if (-not $Project) {
            Write-Host "Error: Project name required. Example: .\run.ps1 start hello-world" -ForegroundColor Red
            return
        }
        try {
            Write-Host "Starting infrastructure..." -ForegroundColor Cyan
            # Sandbox mounts only this project at /workspace (see docker-compose.yml).
            $env:ACTIVE_PROJECT = $Project
            docker compose up -d
            Write-Host "Initializing Local AI Developer..." -ForegroundColor Green
            # `--` forwards the project name to `tsx src/index.ts` as argv.
            npm run dev -- $Project
        }
        finally {
            Write-Host "Shutting down infrastructure..." -ForegroundColor Yellow
            docker compose stop
        }
    }
    "stop" { docker compose stop }
    default {
        Write-Host "Available Commands:" -ForegroundColor Cyan
        Write-Host "  install           : Install Node dependencies and pull the sandbox image"
        Write-Host "  start <project>   : Start Docker and run the orchestrator for a project"
        Write-Host "  stop              : Stop Docker containers"
    }
}
