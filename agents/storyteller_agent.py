from .base import BaseAgent
from prompts.planner_prompts import STORYTELLER_PROMPT


class StorytellerAgent(BaseAgent):
    def __init__(self, llm):
        super().__init__("Storyteller", STORYTELLER_PROMPT, llm)
