from pydantic import BaseModel
from typing import List, Dict, Any

class SessionState(BaseModel):
    project_name: str
    current_agent: str = "architect"
    history: List[Dict[str, Any]] = []
    is_running: bool = True
