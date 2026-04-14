import os

class ContextBuilder:
    def __init__(self, rules_path="./rules"):
        self.rules_path = rules_path

    def build_prompt(self, agent_type):
        prompt = f"You are a Senior {agent_type.capitalize()}. Follow these rules strictly:\n\n"

        for root, _, files in os.walk(self.rules_path):
            for file in files:
                if file.endswith(".md"):
                    with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                        prompt += f"\n--- RULE: {file} ---\n"
                        prompt += f.read() + "\n"
        return prompt
