from .base import BaseAgent
from .agent_config import AgentConfig
from prompts.planner_prompts import STORYTELLER_PROMPT


class StorytellerAgent(BaseAgent):
    def __init__(self, llm, config: AgentConfig = None):
        super().__init__("Storyteller", STORYTELLER_PROMPT, llm, config)
