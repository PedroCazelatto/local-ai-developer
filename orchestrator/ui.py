from rich.console import Console

class UI:
    def __init__(self):
        self.console = Console()

    def clear_screen(self):
        self.console.clear()

    def get_input(self):
        self.console.print()
        return self.console.input("[bold white on grey23] USER > [/bold white on grey23] ")

    def display_message(self, role, content):
        colors = {
            "system": "blue",
            "architect": "magenta",
            "dev": "cyan",
            "ai": "green"
        }
        color = colors.get(role, "white")
        if role != "user":
            self.console.print(f"\n[{color}][bold]{role.upper()} >[/bold] {content}[/{color}]")

    def log_action(self, action_name, details):
        self.display_message("system", f"{action_name}: {details}")

    def error(self, message):
        self.console.print(f"\n[bold red]X ERROR:[/bold red] {message}")

    def show_agent_status(self, agent_name):
        self.console.print(f"\n[bold reverse {agent_name}] ACTIVE: {agent_name.upper()} [/bold reverse {agent_name}]\n")
