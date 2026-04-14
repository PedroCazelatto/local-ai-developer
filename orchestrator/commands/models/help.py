def run(orc, args):
    help_text = """
    [bold magenta]/models[/bold magenta] commands:
    - [cyan]list[/cyan]: Interactive selection of local models.
    - [cyan]pull <name>[/cyan]: Download a new model from Ollama.
    """
    orc.ui.display_message("system", help_text)
