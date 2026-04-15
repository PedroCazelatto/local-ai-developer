from interface.command_processor import CommandProcessor
from core.ui.renderer import UIRenderer

class TerminalLoop:
    def __init__(self) -> None:
        self.processor = CommandProcessor()
        self.renderer = UIRenderer()

    def get_input(self) -> str:
        """Prompts the user for input with consistent styling."""
        return self.renderer.console.input("\n[bold green]YOU > [/]")

    def display_system_info(self, message: str) -> None:
        """Displays system-level notifications."""
        self.renderer.display_chat("system", message)
