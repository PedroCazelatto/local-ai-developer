import os

def write_file(project_path, file_path, content):
    full_path = os.path.abspath(os.path.join(project_path, file_path))
    project_root = os.path.abspath(project_path)

    if not full_path.startswith(project_root):
        return "Error: Security breach attempt. Access denied outside project directory."

    try:
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return f"File {file_path} written successfully."
    except Exception as e:
        return f"Error writing file: {str(e)}"
