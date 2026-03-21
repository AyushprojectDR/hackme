"""
AgentConfig — behavioral profile for each agent.

Inspired by MiroFish's per-agent activity/stance/sentiment config.
Controls HOW an agent behaves, not just WHAT it knows (that's the system prompt).

Fields:
  activity_level  : 0.0–1.0  — how verbose/thorough the agent is
  stance          : supportive | opposing | neutral | observer
  sentiment_bias  : -1.0–1.0  — negative = critical, positive = constructive
  use_insight_forge: whether this agent uses multi-query recall (more expensive)
"""

from dataclasses import dataclass, field


@dataclass
class AgentConfig:
    activity_level:    float = 0.7
    stance:            str   = "neutral"      # supportive | opposing | neutral | observer
    sentiment_bias:    float = 0.0            # -1.0 (critical) → +1.0 (constructive)
    use_insight_forge: bool  = False          # multi-query decomposed recall

    def behavioral_instructions(self) -> str:
        """Returns a short paragraph appended to the agent's system prompt."""
        lines = ["\n\nBEHAVIORAL PARAMETERS (follow these strictly):"]

        # Verbosity
        if self.activity_level >= 0.8:
            lines.append("- Be thorough and exhaustive. Cover every angle. Use detailed bullet points.")
        elif self.activity_level <= 0.3:
            lines.append("- Be extremely concise. Maximum 5 bullet points. No padding.")
        else:
            lines.append("- Be balanced — thorough where it matters, brief where it doesn't.")

        # Stance
        if self.stance == "opposing":
            lines.append("- Take a critical, contrarian stance. Push back on consensus. Find the holes.")
        elif self.stance == "supportive":
            lines.append("- Be constructive and solution-oriented. Build on what others have said.")
        elif self.stance == "observer":
            lines.append("- Stay neutral and observational. Report what you see, don't advocate.")

        # Sentiment
        if self.sentiment_bias >= 0.5:
            lines.append("- Frame findings constructively. Highlight opportunities alongside risks.")
        elif self.sentiment_bias <= -0.5:
            lines.append("- Be skeptical and critical. Assume things will go wrong unless proven otherwise.")

        return "\n".join(lines)


# ------------------------------------------------------------------ #
# Default configs per agent role                                       #
# ------------------------------------------------------------------ #

AGENT_CONFIGS: dict[str, AgentConfig] = {
    "explorer": AgentConfig(
        activity_level=0.9,
        stance="supportive",
        sentiment_bias=0.6,
        use_insight_forge=True,   # needs broad recall of past EDA findings
    ),
    "skeptic": AgentConfig(
        activity_level=0.7,
        stance="opposing",
        sentiment_bias=-0.7,      # aggressively critical
        use_insight_forge=False,
    ),
    "statistician": AgentConfig(
        activity_level=0.8,
        stance="observer",
        sentiment_bias=0.0,       # pure neutral
        use_insight_forge=False,
    ),
    "feature_engineer": AgentConfig(
        activity_level=0.85,
        stance="supportive",
        sentiment_bias=0.4,
        use_insight_forge=True,   # benefits from recalling what features worked before
    ),
    "ethicist": AgentConfig(
        activity_level=0.6,
        stance="observer",
        sentiment_bias=-0.3,      # slightly cautious
        use_insight_forge=False,
    ),
    "pragmatist": AgentConfig(
        activity_level=0.75,
        stance="neutral",
        sentiment_bias=0.2,
        use_insight_forge=True,   # recall what plans succeeded in similar past runs
    ),
    "devil_advocate": AgentConfig(
        activity_level=0.8,
        stance="opposing",
        sentiment_bias=-0.8,      # maximally contrarian
        use_insight_forge=False,
    ),
    "optimizer": AgentConfig(
        activity_level=0.85,
        stance="supportive",
        sentiment_bias=0.3,
        use_insight_forge=True,   # recall which hyperparameter strategies worked
    ),
    "architect": AgentConfig(
        activity_level=0.7,
        stance="observer",
        sentiment_bias=0.1,
        use_insight_forge=False,
    ),
    "storyteller": AgentConfig(
        activity_level=0.9,
        stance="supportive",
        sentiment_bias=0.7,       # narrative should be positive/compelling
        use_insight_forge=False,
    ),
    "code_writer": AgentConfig(
        activity_level=1.0,
        stance="neutral",
        sentiment_bias=0.0,
        use_insight_forge=True,   # must recall what code patterns failed before
    ),
}
