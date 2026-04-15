from rich.style import Style

class UITheme:
    def __init__(self) -> None:
        self.styles = {
            "architect": Style(color="cyan", bold=True),
            "developer": Style(color="green", bold=True),
            "system": Style(color="yellow", italic=True),
            "error": Style(color="red", bold=True),
            "tool": Style(color="magenta")
        }
