import os

def consult_knowledge(category, rule_name):
    path = f"./rules/{category}/{rule_name}.md"
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return f"Error: {rule_name} isn't engaged with {category}."
