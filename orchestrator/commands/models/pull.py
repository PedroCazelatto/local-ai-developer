import ollama

def run(orc, args):
    if len(args) < 1:
        orc.ui.error("Usage: /models pull <model-name>")
        return

    model_name = args[0]
    orc.ui.log_action("Ollama", f"Starting download of {model_name}...")

    try:
        ollama.pull(model_name)
        orc.ui.log_action("Success", f"Model {model_name} is ready.")
        orc.llm.set_model(model_name)
    except Exception as e:
        orc.ui.error(f"Download failed: {str(e)}")
