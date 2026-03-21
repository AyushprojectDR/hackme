"""
Parses the stdout of a training script to extract structured metrics
and classify the failure type when training doesn't succeed.
"""

import json
import re
from dataclasses import dataclass, field
from typing import Optional


# Error categories — used to pick the right recovery strategy
ERROR_OOM          = "out_of_memory"
ERROR_IMPORT       = "import_error"
ERROR_VALUE        = "value_error"
ERROR_CONVERGENCE  = "convergence_error"
ERROR_DATA         = "data_error"
ERROR_TIMEOUT      = "timeout"
ERROR_UNKNOWN      = "unknown"


@dataclass
class ParsedResult:
    success:    bool
    metrics:    dict = field(default_factory=dict)
    error_type: Optional[str] = None
    error_msg:  Optional[str] = None


def parse_metrics(stdout: str) -> dict:
    """Extract METRICS: {...} line from stdout."""
    match = re.search(r"METRICS:\s*(\{.*?\})", stdout, re.DOTALL)
    if not match:
        return {}
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return {}


def classify_error(stderr: str, stdout: str) -> tuple[str, str]:
    """Return (error_type, short_message)."""
    combined = (stderr + stdout).lower()

    if "memoryerror" in combined or "out of memory" in combined:
        return ERROR_OOM, "Out of memory — model or batch too large"
    if "modulenotfounderror" in combined or "importerror" in combined:
        pkg = re.search(r"no module named '([^']+)'", combined)
        return ERROR_IMPORT, f"Missing package: {pkg.group(1) if pkg else 'unknown'}"
    if "valueerror" in combined:
        msg = re.search(r"valueerror: (.+)", combined)
        return ERROR_VALUE, msg.group(1)[:120] if msg else "ValueError in training"
    if "convergencewarning" in combined or "did not converge" in combined:
        return ERROR_CONVERGENCE, "Model did not converge — try more iterations or different solver"
    if "keyerror" in combined or "column" in combined and "not found" in combined:
        return ERROR_DATA, "Data shape / column mismatch"
    return ERROR_UNKNOWN, (stderr or stdout)[:200].strip()


def parse(stdout: str, stderr: str, returncode: int, timed_out: bool = False) -> ParsedResult:
    if timed_out:
        return ParsedResult(success=False, error_type=ERROR_TIMEOUT, error_msg="Script timed out")

    metrics = parse_metrics(stdout)
    if returncode == 0 and metrics:
        return ParsedResult(success=True, metrics=metrics)

    error_type, error_msg = classify_error(stderr, stdout)
    return ParsedResult(success=False, metrics=metrics, error_type=error_type, error_msg=error_msg)
