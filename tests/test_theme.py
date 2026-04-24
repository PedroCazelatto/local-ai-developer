import pytest
from core.ui.theme import UITheme

PERSONAS = [
    "explorer",
    "architect",
    "product_owner",
    "sequencer",
    "developer",
    "logic_reviewer",
    "standards_reviewer",
]

class TestPersonaColors:
    @pytest.mark.parametrize("persona", PERSONAS)
    def test_every_persona_has_a_dedicated_style(self, persona: str):
        theme = UITheme()
        style = theme.for_role(persona)
        assert style != "white", f"{persona} falls back to the unknown-role default"

    def test_personas_have_distinct_colors(self):
        theme = UITheme()
        styles = {p: theme.for_role(p) for p in PERSONAS}
        assert len(set(styles.values())) == len(PERSONAS), f"duplicate styles: {styles}"


class TestFallback:
    def test_unknown_role_falls_back_to_white(self):
        assert UITheme().for_role("nonexistent") == "white"

    def test_lookup_is_case_insensitive(self):
        theme = UITheme()
        assert theme.for_role("ARCHITECT") == theme.for_role("architect")


class TestSystemRoles:
    @pytest.mark.parametrize("role", ["user", "system", "error", "tool"])
    def test_system_role_has_a_style(self, role: str):
        assert UITheme().for_role(role) != "white"
