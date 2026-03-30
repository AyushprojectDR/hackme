"""
DiagnosticAgent — root cause analysis BEFORE blind retry.

Inspired by Karpathy's principle: understand WHY things fail before fixing them.
Instead of injecting raw error text and hoping the LLM self-corrects,
this agent analyzes the failure to find the actual root cause, classifies it,
and produces a targeted fix recommendation for the next attempt.

Usage:
    diag = DiagnosticAgent(llm)
    result = diag.analyze(error_msg, code, context)

    # result.root_cause      → why it failed (not just what the error says)
    # result.failure_class   → data_shape | type_mismatch | model_config | ...
    # result.targeted_fix    → specific code-level change to make
    # result.redesign_needed → True = change the whole model approach
    # result.confidence      → 0.0-1.0
"""

from dataclasses import dataclass
from langchain.schema import HumanMessage, SystemMessage


DIAGNOSTIC_SYSTEM_PROMPT = """You are the DiagnosticAgent — a root cause analyst for ML training failures.

When code fails, you dig past the symptom to find the actual root cause.

Output EXACTLY this format — no markdown, no extra lines, no preamble:

ROOT_CAUSE: <one sentence — WHY it failed, not what the error message says>
FAILURE_CLASS: <data_shape | type_mismatch | model_config | missing_lib | data_leakage | logic_error | convergence | oom | timeout | other>
TARGETED_FIX: <exactly what line/section of code to change and how>
REDESIGN_NEEDED: <yes | no>
CONFIDENCE: <0.0 to 1.0>

Rules:
- ROOT_CAUSE must explain the underlying reason, not restate the error
- TARGETED_FIX must be actionable — a concrete change the CodeWriter can implement
- REDESIGN_NEEDED=yes only if the model architecture / problem framing must change
- CONFIDENCE reflects how certain you are about the root cause
"""


@dataclass
class Diagnosis:
    root_cause:      str   = ""
    failure_class:   str   = "other"
    targeted_fix:    str   = ""
    redesign_needed: bool  = False
    confidence:      float = 0.5
    raw:             str   = ""

    def format_for_retry(self) -> str:
        """Returns a concise retry context block for the CodeWriter."""
        return (
            f"[DIAGNOSTIC ANALYSIS]\n"
            f"Root cause      : {self.root_cause}\n"
            f"Failure class   : {self.failure_class}\n"
            f"Targeted fix    : {self.targeted_fix}\n"
            f"Redesign needed : {'YES — change the model approach' if self.redesign_needed else 'NO — fix the code'}\n"
            f"Confidence      : {self.confidence:.0%}\n"
        )


class DiagnosticAgent:
    """
    Analyzes a training failure to produce structured root cause + targeted fix.

    Called by CodeGenerationPhase._handle_failure() before each retry,
    replacing the previous pattern of blindly injecting raw error text.
    """

    def __init__(self, llm):
        self.llm = llm

    def analyze(
        self,
        error_msg: str,
        code:      str = "",
        context:   str = "",
    ) -> Diagnosis:
        """
        Analyze a training failure and return a structured Diagnosis.
        Falls back to a default Diagnosis if the LLM call itself fails.
        """
        # Trim to avoid context overflow
        code_snippet    = code[-2500:]    if len(code) > 2500    else code
        context_snippet = context[-800:]  if len(context) > 800  else context
        error_snippet   = error_msg[:600] if len(error_msg) > 600 else error_msg

        prompt = (
            "TRAINING SCRIPT FAILED.\n\n"
            f"ERROR:\n{error_snippet}\n\n"
            f"RELEVANT CODE (last 2500 chars):\n{code_snippet or '(not available)'}\n\n"
            f"ANALYSIS CONTEXT:\n{context_snippet or '(none)'}\n\n"
            "Diagnose this failure."
        )

        try:
            messages = [
                SystemMessage(content=DIAGNOSTIC_SYSTEM_PROMPT),
                HumanMessage(content=prompt),
            ]
            response = self.llm.invoke(messages)
            raw = response.content.strip() if hasattr(response, "content") else str(response).strip()
            print(f"\n🔬 [DiagnosticAgent] Analysis complete.")
            return self._parse(raw)

        except Exception as exc:
            print(f"\n[DiagnosticAgent] ⚠️  LLM call failed: {exc}")
            return Diagnosis(
                root_cause=f"Diagnostic unavailable: {str(exc)[:80]}",
                targeted_fix="Review error message manually and adjust approach",
                raw=str(exc),
            )

    # ------------------------------------------------------------------ #
    # Parser                                                               #
    # ------------------------------------------------------------------ #

    def _parse(self, raw: str) -> Diagnosis:
        d = Diagnosis(raw=raw)
        for line in raw.splitlines():
            stripped = line.strip()
            if stripped.startswith("ROOT_CAUSE:"):
                d.root_cause = stripped.split(":", 1)[1].strip()
            elif stripped.startswith("FAILURE_CLASS:"):
                d.failure_class = stripped.split(":", 1)[1].strip().lower()
            elif stripped.startswith("TARGETED_FIX:"):
                d.targeted_fix = stripped.split(":", 1)[1].strip()
            elif stripped.startswith("REDESIGN_NEEDED:"):
                d.redesign_needed = stripped.split(":", 1)[1].strip().lower() == "yes"
            elif stripped.startswith("CONFIDENCE:"):
                try:
                    d.confidence = float(stripped.split(":", 1)[1].strip())
                except ValueError:
                    d.confidence = 0.5
        return d
