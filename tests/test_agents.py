import pytest
from agents.factory import AgentFactory


EXPECTED_PERSONAS = {
    "explorer",
    "architect",
    "product_owner",
    "sequencer",
    "developer",
    "logic_reviewer",
    "standards_reviewer",
}


class TestAvailableRoles:
    def test_lists_every_persona_file(self):
        assert set(AgentFactory.available_roles()) == EXPECTED_PERSONAS

    def test_result_is_sorted(self):
        roles = AgentFactory.available_roles()
        assert roles == sorted(roles)


class TestGetAgent:
    @pytest.mark.parametrize("role", sorted(EXPECTED_PERSONAS))
    def test_loads_every_persona(self, role):
        agent = AgentFactory.get_agent(role)
        assert agent.role == role
        assert agent.persona.startswith("# Role:")
        assert len(agent.persona) > 500

    def test_role_is_normalized_to_lowercase(self):
        agent = AgentFactory.get_agent("ARCHITECT")
        assert agent.role == "architect"

    def test_strips_whitespace_from_role(self):
        agent = AgentFactory.get_agent("  developer  ")
        assert agent.role == "developer"

    def test_unknown_persona_raises_with_available_list(self):
        with pytest.raises(ValueError) as exc:
            AgentFactory.get_agent("does_not_exist")
        message = str(exc.value)
        assert "does_not_exist" in message
        assert "architect" in message  # list of available roles is included

    def test_default_tools_is_empty(self):
        agent = AgentFactory.get_agent("architect")
        assert agent.tools == []
