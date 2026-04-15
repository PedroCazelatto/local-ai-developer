import os

class RulesLoader:
    def __init__(self, rules_path: str = "./rules") -> None:
        self.rules_path = rules_path

    def load_all(self) -> str:
        if not os.path.exists(self.rules_path):
            return ""

        combined_rules = []
        for file in os.listdir(self.rules_path):
            if file.endswith((".md", ".txt")):
                with open(os.path.join(self.rules_path, file), "r", encoding="utf-8") as f:
                    combined_rules.append(f.read())

        return "\n\n".join(combined_rules)
