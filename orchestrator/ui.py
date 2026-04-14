from rich.console import Console
from rich.layout import Layout
from rich.text import Text

class UI:
    def __init__(self):
        self.console = Console()
        self.chat_history = Text()

    def clear_screen(self):
        self.console.clear()

    def get_layout(self, current_tokens, limit, is_thinking=False, agent_name=""):
        layout = Layout()
        layout.split_column(
            Layout(name="main", ratio=1),
            Layout(name="footer", size=2)
        )

        main_content = self.chat_history.copy()
        if is_thinking:
            main_content.append(f"\n {agent_name.upper()} is thinking...", style="dim yellow")

        layout["main"].update(main_content)

        percentage = (current_tokens / limit) * 100 if limit > 0 else 0
        color = "green" if percentage < 70 else "yellow" if percentage < 90 else "red"

        status = Text.assemble(
            ("\n CONTEXT USAGE: ", "bold white"),
            (f"{int(percentage)}%", f"bold {color}"),
            (f" ({current_tokens}/{limit} tokens)", "dim white")
        )

        layout["footer"].update(status)
        return layout

    def update_history(self, role, content, color=None):
        if not color:
            colors = {"system": "blue", "architect": "magenta", "dev": "cyan", "ai": "green", "user": "white"}
            color = colors.get(role, "white")

        if role == "user":
            self.chat_history.append(f"\n USER > {content}\n", style="bold white")
        else:
            self.chat_history.append(f"\n {role.upper()} > ", style=f"bold {color}")
            self.chat_history.append(f"{content}\n", style=color)

    def get_input(self):
        return self.console.input("[bold white on grey23] USER > [/bold white on grey23] ")
