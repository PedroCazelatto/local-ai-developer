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
            Write-Host "Erro: informe o projeto. Ex: .\run.ps1 run HelloWorld"
        } else {
            & $VENV_PYTHON main.py $Project
        }
    }
    "install" {
        & $VENV_PYTHON -m pip install -r requirements.txt
    }
    default {
        Write-Host "Comandos: up, stop, down, install, run [projeto]"
    }
}
