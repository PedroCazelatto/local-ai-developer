from typing import Optional, List

class CommandProcessor:
    def __init__(self) -> None:
        self.commands = ["/swap", "/clear", "/exit", "/context"]

    def is_command(self, user_input: str) -> bool:
        """Checks if the input starts with a slash."""
        return user_input.strip().startswith("/")

    def parse_command(self, user_input: str) -> List[str]:
        """Splits the command and its arguments."""
        parts = user_input.strip().split(" ")
        return parts
