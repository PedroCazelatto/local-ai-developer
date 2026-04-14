def run(orc, args):
    orc.switch_agent(orc.active_agent)
    orc.ui.display_message("system", f"Context cleared.")
