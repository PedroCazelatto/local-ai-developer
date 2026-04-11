import os

def list_files(project_path):
    """Lista todos os arquivos no diretório do projeto."""
    try:
        files = []
        for root, _, filenames in os.walk(project_path):
            for f in filenames:
                files.append(os.path.relpath(os.path.join(root, f), project_path))
        return "\n".join(files)
    except Exception as e:
        return f"Erro ao listar arquivos: {str(e)}"
