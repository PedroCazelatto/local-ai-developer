import os

def list_files(project_path):
    try:
        files = []
        for root, _, filenames in os.walk(project_path):
            for f in filenames:
                files.append(os.path.relpath(os.path.join(root, f), project_path))
        return "\n".join(files)
    except Exception as e:
        return f"Error listing all files: {str(e)}"
