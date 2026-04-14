import ollama
import questionary

def run(orc, args):
    models_info = ollama.list()
    available = [m['name'] for m in models_info['models']]

    selected = questionary.select(
        "Select the model to use:",
        choices=available,
        default=orc.llm.model
    ).ask()

    if selected:
        orc.llm.set_model(selected)
        orc.ui.log_action("Model Switched", selected)
