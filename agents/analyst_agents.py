from .base import BaseAgent
from .agent_config import AgentConfig
from prompts.analyst_prompts import (
    EXPLORER_PROMPT, SKEPTIC_PROMPT, STATISTICIAN_PROMPT, ETHICIST_PROMPT
)


class ExplorerAgent(BaseAgent):
    def __init__(self, llm, config: AgentConfig = None):
        super().__init__("Explorer", EXPLORER_PROMPT, llm, config)


class SkepticAgent(BaseAgent):
    def __init__(self, llm, config: AgentConfig = None):
        super().__init__("Skeptic", SKEPTIC_PROMPT, llm, config)


class StatisticianAgent(BaseAgent):
    def __init__(self, llm, config: AgentConfig = None):
        super().__init__("Statistician", STATISTICIAN_PROMPT, llm, config)


class EthicistAgent(BaseAgent):
    def __init__(self, llm, config: AgentConfig = None):
        super().__init__("Ethicist", ETHICIST_PROMPT, llm, config)
