import pytest
from core.session.memory import SessionMemory


class TestActivePersonaRequired:
    def test_add_without_active_persona_raises(self):
        memory = SessionMemory()
        with pytest.raises(RuntimeError):
            memory.add("user", "hi")

    def test_history_with_no_active_persona_is_empty(self):
        assert SessionMemory().history == []

    def test_clear_is_noop_with_no_active_persona(self):
        SessionMemory().clear()  # must not raise


class TestPerPersonaIsolation:
    def test_swapping_persona_swaps_visible_history(self):
        memory = SessionMemory()

        memory.set_active_persona("explorer")
        memory.add("user", "hello explorer")

        memory.set_active_persona("architect")
        memory.add("user", "hello architect")

        assert len(memory.history) == 1
        assert memory.history[0]["content"] == "hello architect"

        memory.set_active_persona("explorer")
        assert len(memory.history) == 1
        assert memory.history[0]["content"] == "hello explorer"

    def test_clear_only_wipes_active_persona(self):
        memory = SessionMemory()

        memory.set_active_persona("developer")
        memory.add("user", "dev msg")

        memory.set_active_persona("architect")
        memory.add("user", "architect msg")
        memory.clear()

        assert memory.history == []

        memory.set_active_persona("developer")
        assert len(memory.history) == 1
        assert memory.history[0]["content"] == "dev msg"

    def test_reactivating_persona_preserves_history(self):
        memory = SessionMemory()

        memory.set_active_persona("architect")
        memory.add("user", "first")
        memory.set_active_persona("explorer")
        memory.set_active_persona("architect")
        memory.add("user", "second")

        contents = [entry["content"] for entry in memory.history]
        assert contents == ["first", "second"]


class TestMessageShape:
    def test_add_stores_role_and_content(self):
        memory = SessionMemory()
        memory.set_active_persona("architect")
        memory.add("user", "hi")
        assert memory.history[0] == {"role": "user", "content": "hi"}

    def test_add_with_name_includes_name_field(self):
        memory = SessionMemory()
        memory.set_active_persona("architect")
        memory.add("tool", "result", name="list_files")
        assert memory.history[0]["name"] == "list_files"

    def test_add_without_name_omits_name_field(self):
        memory = SessionMemory()
        memory.set_active_persona("architect")
        memory.add("user", "hi")
        assert "name" not in memory.history[0]
