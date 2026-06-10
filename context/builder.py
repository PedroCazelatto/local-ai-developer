class ContextBuilder:
    # Shared tool-use mechanics for every phase. Phase markdown says WHICH tools
    # a role should reach for; this block says HOW to call them at all — kept in
    # code so the six phase files don't each repeat it.
    _TOOL_USE_GUIDANCE = (
        "# Tool Use\n"
        "- When you decide to read, list, search, write, edit, or run something, "
        "emit the tool call in that same turn. Never describe or promise an action "
        "without performing it.\n"
        "- Call tools only through the tool-calling mechanism. Do not print "
        "tool-call JSON as text in your reply, with or without markdown fences.\n"
        "- After a tool result arrives, continue the task using that result.\n"
    )

    def build_system_prompt(self, agent_persona: str, project_state: str) -> str:
        return (
            f"{agent_persona}\n\n"
            f"{self._TOOL_USE_GUIDANCE}\n"
            f"# Project Context\n"
            f"{project_state}\n"
        )
