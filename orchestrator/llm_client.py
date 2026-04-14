import ollama
import re
import os

class LLMClient:
    def __init__(self, model=None):
        self.model = model
        self.history = []
        self.total_tokens = 0
        self.context_limit = int(os.getenv("OLLAMA_NUM_CTX", 2048))

    def set_model(self, model_name):
        self.model = model_name
        if os.getenv("OLLAMA_NUM_CTX") is None:
            try:
                info = ollama.show(model_name)
                params = info.get('parameters', '')
                match = re.search(r'num_ctx\s+(\d+)', params)
                self.context_limit = int(match.group(1)) if match else 2048
            except:
                self.context_limit = 2048

    def clear_context(self, system_prompt):
        self.history = [{'role': 'system', 'content': system_prompt}]
        self.total_tokens = 0

    def chat_stream(self, user_message=None, tools=None):
        if not self.model:
            yield {"error": "No model selected."}
            return

        if user_message:
            self.history.append({'role': 'user', 'content': user_message})

        try:
            stream = ollama.chat(
                model=self.model,
                messages=self.history,
                tools=tools,
                stream=True,
                options={
                    "num_ctx": self.context_limit
                }
            )

            full_content = ""
            tool_calls = []

            for chunk in stream:
                msg = chunk.get('message', {})
                if msg.get('content'):
                    content = msg['content']
                    full_content += content
                    yield {"chunk": content}

                if msg.get('tool_calls'):
                    tool_calls = msg['tool_calls']

                if chunk.get('done'):
                    self.total_tokens += chunk.get('prompt_eval_count', 0) + chunk.get('eval_count', 0)

            final_msg = {'role': 'assistant', 'content': full_content}
            if tool_calls:
                final_msg['tool_calls'] = tool_calls
                yield {"tool_calls": tool_calls}

            self.history.append(final_msg)
        except Exception as e:
            yield {"error": str(e)}
