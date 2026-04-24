from typing import List


class CommandProcessor:
    def __init__(self) -> None:
        self.commands = ("/swap", "/clear", "/exit")

    def is_command(self, user_input: str) -> bool:
        return user_input.strip().startswith("/")

    def parse_command(self, user_input: str) -> List[str]:
        return user_input.strip().split()
