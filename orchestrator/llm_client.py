import ollama

class LLMClient:
    def __init__(self, model=None):
        self.model = model
        self.history = []

    def set_model(self, model_name):
        self.model = model_name

    def clear_context(self, system_prompt):
        self.history = [{'role': 'system', 'content': system_prompt}]

    def chat(self, user_message, tools=None):
        if not self.model:
            return {"role": "assistant", "content": "❌ No model selected. Use /models to pick one."}

        self.history.append({'role': 'user', 'content': user_message})
        try:
            response = ollama.chat(model=self.model, messages=self.history, tools=tools)
            ai_msg = response['message']
            self.history.append(ai_msg)
            return ai_msg
        except Exception as e:
            return {"role": "assistant", "content": f"Error: {str(e)}"}
