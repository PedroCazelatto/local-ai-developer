from typing import Literal, Optional, List, Dict, Any
from pydantic import BaseModel

class ToolCallFunction(BaseModel):
    name: str
    arguments: Dict[str, Any]

class ToolCall(BaseModel):
    id: Optional[str] = None
    type: Literal["function"] = "function"
    function: ToolCallFunction

class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str
    name: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None

    class Config:
        from_attributes = True

class ExecutionResult(BaseModel):
    success: bool
    output: str
    error: Optional[str] = None
    exit_code: int = 0
