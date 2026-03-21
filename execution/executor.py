"""
CodeExecutor — runs a generated Python script in a subprocess and captures results.

Safety measures:
  - Timeout (default 5 min) kills the process if it hangs
  - Script runs in an isolated temp directory
  - stdout/stderr captured — not streamed to avoid injection
"""

import os
import sys
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from typing import Optional

from .result_parser import parse, ParsedResult


DEFAULT_TIMEOUT = 300   # seconds


@dataclass
class ExecutionResult:
    success:      bool
    metrics:      dict  = field(default_factory=dict)
    stdout:       str   = ""
    stderr:       str   = ""
    elapsed:      float = 0.0
    error_type:   Optional[str] = None
    error_msg:    Optional[str] = None
    script_path:  Optional[str] = None

    def short_summary(self) -> str:
        if self.success:
            return f"SUCCESS in {self.elapsed:.1f}s | metrics: {self.metrics}"
        return f"FAILED ({self.error_type}) in {self.elapsed:.1f}s | {self.error_msg}"


class CodeExecutor:
    """
    Writes a code string to a temp file and runs it with the current Python interpreter.
    Returns a structured ExecutionResult.
    """

    def __init__(self, timeout: int = DEFAULT_TIMEOUT, work_dir: str = None):
        self.timeout  = timeout
        self.work_dir = work_dir or tempfile.gettempdir()

    def run(self, code: str, attempt: int = 1) -> ExecutionResult:
        # Write script to temp file
        script_path = os.path.join(self.work_dir, f"train_attempt_{attempt}.py")
        with open(script_path, "w") as f:
            f.write(code)

        print(f"\n[EXECUTOR] Running script: {script_path}")
        start = time.time()
        timed_out = False

        try:
            proc = subprocess.run(
                [sys.executable, script_path],
                capture_output=True,
                text=True,
                timeout=self.timeout,
                cwd=self.work_dir,
            )
            stdout    = proc.stdout
            stderr    = proc.stderr
            returncode = proc.returncode
        except subprocess.TimeoutExpired as e:
            timed_out  = True
            stdout     = e.stdout or ""
            stderr     = e.stderr or ""
            returncode = -1
        except Exception as e:
            stdout     = ""
            stderr     = str(e)
            returncode = -1

        elapsed = time.time() - start
        parsed: ParsedResult = parse(stdout, stderr, returncode, timed_out)

        return ExecutionResult(
            success     = parsed.success,
            metrics     = parsed.metrics,
            stdout      = stdout,
            stderr      = stderr,
            elapsed     = elapsed,
            error_type  = parsed.error_type,
            error_msg   = parsed.error_msg,
            script_path = script_path,
        )
