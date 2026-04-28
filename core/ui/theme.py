class UITheme:
    def __init__(self) -> None:
        self.styles = {
            "explorer":           "bright_blue bold",
            "architect":          "cyan bold",
            "product_owner":      "bright_magenta bold",
            "sequencer":          "yellow bold",
            "developer":          "green bold",
            "logic_reviewer":     "bright_red bold",
            "standards_reviewer": "bright_yellow bold",
            "user":               "bright_white bold",
            "system":             "grey74 italic",
            "error":              "red bold",
            "tool":               "magenta",
        }

    def for_role(self, role: str) -> str:
        return self.styles.get(role.lower(), "white")

    def shade_for_role(self, role: str) -> str:
        """A softer variant of the role's color, used for assistant body text."""
        base = self.styles.get(role.lower(), "white")
        return base.replace(" bold", "")
