import ollama
import os

class LLMClient:
    def __init__(self):
        self.model = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")
        self.history = []

    def clear_context(self, system_prompt):
        self.history = [{'role': 'system', 'content': system_prompt}]

    def chat(self, user_message, tools=None):
        self.history.append({'role': 'user', 'content': user_message})

        try:
            response = ollama.chat(
                model=self.model,
                messages=self.history,
                tools=tools
            )
            ai_msg = response['message']
            self.history.append(ai_msg)
            return ai_msg
        except Exception as e:
            return {"role": "assistant", "content": f"Error connecting to Ollama: {str(e)}"}
