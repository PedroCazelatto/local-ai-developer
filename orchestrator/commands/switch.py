def run(orc, args):
    if len(args) > 0 and args[0] in ["architect", "dev"]:
        orc.switch_agent(args[0])
    else:
        orc.ui.error("Usage: /switch architect OR /switch dev")
