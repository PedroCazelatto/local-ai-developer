param(
    [string]$Action,
    [string]$Project
)

$VENV_PYTHON = ".\.venv\Scripts\python.exe"

switch ($Action) {
    "up" {
        docker compose up -d
    }
    "stop" {
        docker compose stop
    }
    "down" {
        docker compose down
    }
    "run" {
        if (-not $Project) {
            Write-Host "Error: name the project. Ex: .\run.ps1 run hello-world"
        } else {
            & $VENV_PYTHON main.py $Project
        }
    }
    "install" {
        & $VENV_PYTHON -m pip install -r requirements.txt
    }
    default {
        Write-Host "Commands: up, stop, down, install, run <project name>"
    }
}
