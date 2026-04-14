import ollama

class LLMClient:
    def __init__(self, model=None):
        self.model = model
        self.history = []
        self.total_tokens = 0

    def set_model(self, model_name):
        self.model = model_name

    def clear_context(self, system_prompt):
        self.history = [{'role': 'system', 'content': system_prompt}]
        self.total_tokens = 0

    def chat_stream(self, user_message=None, tools=None):
        if not self.model:
            yield {"error": "No model selected. Use /models to pick one."}
            return

        if user_message:
            self.history.append({'role': 'user', 'content': user_message})

        try:
            stream = ollama.chat(
                model=self.model,
                messages=self.history,
                tools=tools,
                stream=True
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
                    self.total_tokens = chunk.get('prompt_eval_count', 0)

            final_msg = {'role': 'assistant', 'content': full_content}
            if tool_calls:
                final_msg['tool_calls'] = tool_calls
                yield {"tool_calls": tool_calls}

            self.history.append(final_msg)

        except Exception as e:
            yield {"error": str(e)}
