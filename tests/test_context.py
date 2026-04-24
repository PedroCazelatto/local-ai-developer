from context.builder import ContextBuilder


class TestBuildSystemPrompt:
    def test_includes_agent_persona_verbatim(self):
        builder = ContextBuilder()
        persona = "# Role: Architect\nDesigns systems."
        prompt = builder.build_system_prompt(agent_persona=persona, project_state="Project: demo")
        assert persona in prompt

    def test_includes_project_state(self):
        builder = ContextBuilder()
        prompt = builder.build_system_prompt(agent_persona="role", project_state="Project: demo")
        assert "Project: demo" in prompt

    def test_persona_comes_before_project_context(self):
        builder = ContextBuilder()
        prompt = builder.build_system_prompt(agent_persona="PERSONA_MARKER", project_state="STATE_MARKER")
        assert prompt.index("PERSONA_MARKER") < prompt.index("STATE_MARKER")
