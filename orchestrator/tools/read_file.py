import os

def read_file(project_path, file_path):
    full_path = os.path.join(project_path, file_path)
    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {str(e)}"
