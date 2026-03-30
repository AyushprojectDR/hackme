"""
ConversationManager — multi-turn interactive agent conversations.

Inspired by Karpathy's makemore / interactive exploration principle:
"Agents shouldn't just submit reports. They should talk to each other
 until they converge on the right answer."

Instead of a fixed sequential pipeline (A writes → B writes → C writes),
agents can now engage in a live back-and-forth discussion. Each agent sees
the full transcript of what's been said and can:
  - Ask follow-up questions to another agent
  - Challenge a previous statement
  - Propose a synthesis
  - Conclude the discussion with a final verdict

Usage:
    conv = ConversationManager(orchestrator)

    # Two agents debate a specific question
    transcript = conv.discuss(
        participants=["explorer", "skeptic"],
        topic="Is feature X actually meaningful or random noise?",
        max_turns=4,
    )

    # Get the final conclusion
    conclusion = conv.converge("pragmatist", "devil_advocate",
        question="Should we use XGBoost or a neural net for this dataset?")
"""

import uuid
from memory.context_manager import ROLE_ANALYSIS


class ConversationManager:
    """
    Enables multi-turn conversations between agents on a shared topic.

    Each agent sees all previous messages in the conversation,
    can ask questions or challenge claims, and the next agent responds.

    This replaces pure sequential pipelines with interactive rounds
    that converge to a decision faster — closer to how a real team works.
    """

    def __init__(self, orchestrator):
        self.orch = orchestrator

    def discuss(
        self,
        participants:      list,
        topic:             str,
        max_turns:         int  = 4,
        store_in_context:  bool = True,
    ) -> list:
        """
        Run a multi-turn conversation between agents on a topic.

        Participants alternate in round-robin. Each agent sees the full transcript.
        Stops early if any agent says "CONCLUDED: ...".

        Returns list of (agent_name, message) tuples.
        """
        transcript = []
        orch       = self.orch

        print(f"\n💬 [Conversation] {' ↔ '.join(participants)}")
        print(f"   Topic: {topic[:80]}")

        for turn in range(max_turns):
            agent_name = participants[turn % len(participants)]
            if agent_name not in orch.agents:
                print(f"   ⚠️  Agent '{agent_name}' not found — skipping turn")
                continue

            # Build conversation history
            history = (
                "\n".join(f"[{a.upper()}]: {msg}" for a, msg in transcript)
                if transcript
                else "(Conversation just started — you go first.)"
            )

            task = (
                f"CONVERSATION TOPIC: {topic}\n\n"
                f"TRANSCRIPT SO FAR:\n{history}\n\n"
                "YOUR TURN:\n"
                "- Respond directly to what was said\n"
                "- If you have a question for another agent, ask it explicitly\n"
                "- If you agree or disagree, be explicit and give your reason\n"
                "- If the conversation has reached a clear conclusion, end with: "
                "CONCLUDED: <your final verdict in one sentence>"
            )

            print(f"\n   Turn {turn + 1}/{max_turns} — [{agent_name.upper()}]:")

            try:
                response = orch.step(agent_name, task, ROLE_ANALYSIS)
                transcript.append((agent_name, response))

                if "CONCLUDED:" in response:
                    print(f"   ✅ Conversation concluded by {agent_name} at turn {turn + 1}")
                    break
            except Exception as exc:
                print(f"   ⚠️  {agent_name} failed in conversation: {exc}")
                continue

        # Store full transcript in working context
        if store_in_context and transcript:
            lines = [f"MULTI-TURN CONVERSATION — Topic: {topic}\n"]
            for agent, msg in transcript:
                lines.append(f"[{agent.upper()}]:\n{msg}\n")
            orch.context.add(
                "conversation_manager", ROLE_ANALYSIS, "\n".join(lines)
            )
            print(f"\n   💬 Conversation stored in context ({len(transcript)} turns)")

        return transcript

    def converge(
        self,
        agent_a:   str,
        agent_b:   str,
        question:  str,
        max_turns: int = 4,
    ) -> str:
        """
        Two agents discuss until they reach a conclusion.
        Returns the CONCLUDED verdict, or the last message if no conclusion reached.
        """
        transcript = self.discuss(
            participants=[agent_a, agent_b],
            topic=question,
            max_turns=max_turns,
        )
        # Extract explicit conclusion
        for _, msg in reversed(transcript):
            if "CONCLUDED:" in msg:
                return msg.split("CONCLUDED:", 1)[1].strip()
        # Fall back to last message
        return transcript[-1][1] if transcript else ""

    def panel_review(
        self,
        panel:     list,
        artifact:  str,
        max_turns: int = 3,
    ) -> dict:
        """
        Multiple agents each review an artifact (code, plan, findings) once.
        Collects structured feedback per agent.

        Useful for: code review, plan critique, EDA sanity check.
        Returns dict of agent_name → feedback string.
        """
        orch     = self.orch
        feedback = {}

        print(f"\n🔍 [Panel Review] {len(panel)} reviewers on artifact")

        for agent_name in panel:
            if agent_name not in orch.agents:
                continue
            task = (
                f"ARTIFACT TO REVIEW:\n{artifact}\n\n"
                "Give your structured review:\n"
                "- VERDICT: <approve | approve_with_changes | reject>\n"
                "- ISSUES: <list specific problems found>\n"
                "- SUGGESTIONS: <concrete improvements>\n"
                "- CONFIDENCE: <0.0-1.0 in your review>"
            )
            try:
                response = orch.step(agent_name, task, ROLE_ANALYSIS)
                feedback[agent_name] = response
            except Exception as exc:
                feedback[agent_name] = f"[Review failed: {exc}]"

        return feedback
