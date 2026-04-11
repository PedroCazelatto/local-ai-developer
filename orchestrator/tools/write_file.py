import os

def write_file(project_path, file_path, content):
    full_path = os.path.join(project_path, file_path)
    try:
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return f"File {file_path} written with success."
    except Exception as e:
        return f"Error writing to file: {str(e)}"
