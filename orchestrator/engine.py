import ollama

class Engine:
    def __init__(self, model="qwen2.5-coder:14b"):
        self.model = model

    def chat(self, messages, tools=None):
        # Aqui fazemos a chamada ao Ollama passando as ferramentas
        response = ollama.chat(
            model=self.model,
            messages=messages,
            tools=tools
        )
        return response['message']
