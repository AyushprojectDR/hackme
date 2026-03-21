"""
Orchestrator — routes tasks, manages context, wires per-agent memory, drives the training retry loop.

Modes:
  manual  — fixed pipeline, caller defines agent order
  auto    — orchestrator LLM decides each step
  train   — full autonomous loop: analyze → generate code → execute → retry on failure

Memory integration:
  - Before each step: agent recalls relevant past memories from ChromaDB
  - After each step:  output stored in agent's ChromaDB collection + graph node added
  - Graph edges are added between consecutive nodes in each run
"""

import os
import uuid
from concurrent.futures import ThreadPoolExecutor

from langchain.schema import HumanMessage, SystemMessage

from memory.context_manager import ContextManager, ROLE_ANALYSIS, ROLE_PLAN, ROLE_NARRATIVE, ROLE_META
from memory.agent_memory    import MemorySystem
from memory.graph_store     import INFORMED_BY, RETRY_OF, FAILURE_LED_TO, CROSS_RUN
from execution.executor     import CodeExecutor, ExecutionResult
from prompts.orchestrator_prompt import ORCHESTRATOR_PROMPT


MAX_AUTO_STEPS    = 10
MAX_TRAIN_RETRIES = 4


class Orchestrator:

    def __init__(
        self,
        agents:        dict,
        llm            = None,
        executor:      CodeExecutor  = None,
        memory_system: MemorySystem  = None,
    ):
        self.agents        = agents
        self.llm           = llm
        self.executor      = executor or CodeExecutor()
        self.memory        = memory_system
        self.context       = ContextManager()
        self.run_id        = str(uuid.uuid4())[:12]
        self._last_node_id = None   # track last node for graph edges

        # Wire memory into each agent
        if self.memory:
            for name, agent in self.agents.items():
                mem = self.memory.get(name)
                if mem:
                    agent.attach_memory(mem)

    # ------------------------------------------------------------------ #
    # Core step                                                            #
    # ------------------------------------------------------------------ #

    def step(self, agent_name: str, task: str, role: str = ROLE_ANALYSIS) -> str:
        if agent_name not in self.agents:
            raise ValueError(f"Unknown agent '{agent_name}'. Available: {list(self.agents.keys())}")

        agent   = self.agents[agent_name]
        ctx_str = self.context.get_context_string()
        node_id = str(uuid.uuid4())[:12]

        response = agent.run(
            context=ctx_str,
            task=task,
            node_id=node_id,
            run_id=self.run_id,
            role=role,
        )

        self.context.add(agent_name, role, response)

        # Add graph edge from previous node
        if self.memory and self._last_node_id:
            self.memory.graph_store.add_edge(
                from_node=self._last_node_id,
                to_node=node_id,
                edge_type=INFORMED_BY,
            )
        self._last_node_id = node_id

        print(f"\n{'='*60}")
        print(f"  {agent_name.upper()}")
        print(f"{'='*60}")
        print(response)

        return response

    def parallel_step(self, steps: list[tuple[str, str, str]]):
        """Run multiple (agent_name, task, role) steps concurrently."""
        with ThreadPoolExecutor() as ex:
            futures = [ex.submit(self.step, name, task, role) for name, task, role in steps]
            for f in futures:
                f.result()

    # ------------------------------------------------------------------ #
    # Manual pipeline                                                      #
    # ------------------------------------------------------------------ #

    def run_manual(self, dataset_summary: str):
        print(f"\n🚀 Starting analysis (manual mode) | run_id: {self.run_id}\n")
        self.context.add_dataset_context(dataset_summary)

        print("\n⚡ Round 1: Explorer + Skeptic + Statistician (parallel)...")
        self.parallel_step([
            ("explorer",     "Perform thorough EDA. Find patterns, correlations, key features. Suggest the target variable.", ROLE_ANALYSIS),
            ("skeptic",      "Inspect data quality: missing values, outliers, duplicates, leakage risks.", ROLE_ANALYSIS),
            ("statistician", "Analyze distributions, multicollinearity, statistical significance of correlations.", ROLE_ANALYSIS),
        ])

        print("\n⚡ Round 2: Feature Engineer + Ethicist (parallel)...")
        self.parallel_step([
            ("feature_engineer", "Suggest new features, encoding strategies, transformations. Flag redundant features.", ROLE_ANALYSIS),
            ("ethicist",         "Identify sensitive attributes, bias risks, and ethical concerns.", ROLE_ANALYSIS),
        ])

        print("\n📋 Round 3: Pragmatist building action plan...")
        self.step("pragmatist", "Create a step-by-step modeling plan. Pick top 2-3 models, specify features, evaluation metric.", ROLE_PLAN)

        print("\n😈 Round 4: Devil's Advocate stress-testing the plan...")
        self.step("devil_advocate", "Challenge the Pragmatist's plan. Suggest an alternative approach.", ROLE_PLAN)

        print("\n🔧 Round 5: Optimizer tuning strategy...")
        self.step("optimizer", "Recommend hyperparameter tuning and cross-validation strategy.", ROLE_PLAN)

        print("\n🏗️  Round 6: Architect designing deployment...")
        self.step("architect", "Design the deployment architecture: serving infra, latency, monitoring.", ROLE_PLAN)

        print("\n📖 Round 7: Storyteller writing the narrative...")
        self.step("storyteller", "Synthesize everything into a compelling narrative for judges.", ROLE_NARRATIVE)

    # ------------------------------------------------------------------ #
    # Auto pipeline                                                        #
    # ------------------------------------------------------------------ #

    def _parse_orchestrator_response(self, raw: str) -> dict:
        result = {"agent": None, "task": None, "complete": False, "reason": ""}
        for line in raw.strip().splitlines():
            if line.startswith("NEXT_AGENT:"):
                result["agent"] = line.split(":", 1)[1].strip().lower()
            elif line.startswith("TASK:"):
                result["task"] = line.split(":", 1)[1].strip()
            elif line.startswith("COMPLETE:"):
                result["complete"] = line.split(":", 1)[1].strip().lower() == "yes"
            elif line.startswith("REASON:"):
                result["reason"] = line.split(":", 1)[1].strip()
        return result

    def _orchestrator_decide(self) -> dict:
        if self.llm is None:
            raise RuntimeError("Provide an LLM to use auto mode.")
        messages = [
            SystemMessage(content=ORCHESTRATOR_PROMPT),
            HumanMessage(content=f"CURRENT ANALYSIS LOG:\n{self.context.get_context_string() or '(Empty)'}\n\nWhat should happen next?"),
        ]
        raw = self.llm.invoke(messages)
        raw_text = raw.content if hasattr(raw, "content") else str(raw)
        decision = self._parse_orchestrator_response(raw_text)
        print(f"\n[ORCHESTRATOR] → {(decision['agent'] or '?').upper()} | {decision['reason']}")
        return decision

    def run_auto(self, dataset_summary: str, max_steps: int = MAX_AUTO_STEPS):
        print(f"\n🤖 Starting analysis (auto mode) | run_id: {self.run_id}\n")
        self.context.add_dataset_context(dataset_summary)
        for _ in range(max_steps):
            decision = self._orchestrator_decide()
            if decision["complete"]:
                print("\n✅ Orchestrator says analysis is complete.")
                break
            if not decision["agent"] or decision["agent"] not in self.agents:
                print(f"\n⚠️  Unknown agent: {decision['agent']}. Stopping.")
                break
            self.step(decision["agent"], decision["task"])
        else:
            print(f"\n⚠️  Reached max steps ({max_steps}). Stopping.")

    # ------------------------------------------------------------------ #
    # Training loop                                                        #
    # ------------------------------------------------------------------ #

    def run_training_loop(
        self,
        dataset_summary: str,
        dataset_path:    str,
        target_col:      str  = None,
        max_retries:     int  = MAX_TRAIN_RETRIES,
        experiment_dir:  str  = "experiments",
    ):
        print(f"\n🤖 Starting training loop | run_id: {self.run_id}\n")
        os.makedirs(experiment_dir, exist_ok=True)
        self.context.add_dataset_context(dataset_summary)

        # Phase 1: Analysis
        print("\n⚡ Phase 1: Parallel analysis...")
        self.parallel_step([
            ("explorer",     "Perform thorough EDA. Identify likely target variable and key features.", ROLE_ANALYSIS),
            ("skeptic",      "Flag data quality issues, missing values, leakage risks.", ROLE_ANALYSIS),
            ("statistician", "Analyze distributions and feature correlations.", ROLE_ANALYSIS),
        ])
        self.step("feature_engineer", "Suggest concrete feature engineering steps.", ROLE_ANALYSIS)
        self.step("pragmatist", "Create a clear modeling plan: target column, models to try, evaluation metric.", ROLE_PLAN)

        # Phase 2: Training retry loop
        last_result:     ExecutionResult = None
        last_code_node:  str             = None
        last_run_id:     str             = self.run_id   # tracks the run_id of the last attempt

        for attempt in range(1, max_retries + 1):
            print(f"\n🔁 Training attempt {attempt}/{max_retries}")

            # Each retry gets a fresh run_id so memories are scoped correctly
            if attempt > 1:
                self.run_id = str(uuid.uuid4())[:12]
                print(f"   New run_id for attempt {attempt}: {self.run_id}")

            if attempt > 1 and last_result:
                self._handle_failure(last_result, attempt, last_run_id, last_code_node)

            # Generate code
            print(f"\n💻 CodeWriter generating script (attempt {attempt})...")
            code_agent = self.agents.get("code_writer")
            if code_agent is None:
                raise RuntimeError("'code_writer' agent not found.")

            node_id  = str(uuid.uuid4())[:12]
            ctx_str  = self.context.get_context_string()
            code     = code_agent.run(
                context=ctx_str,
                dataset_path=dataset_path,
                target_col=target_col,
                node_id=node_id,
                run_id=self.run_id,
            )
            self.context.add_code(code, attempt=attempt)
            last_code_node = node_id

            # Graph edge: previous → code node
            if self.memory and self._last_node_id:
                edge_type = RETRY_OF if attempt > 1 else INFORMED_BY
                self.memory.graph_store.add_edge(self._last_node_id, node_id, edge_type)
            self._last_node_id = node_id

            # Save script to disk
            script_path = os.path.join(experiment_dir, f"train_attempt_{attempt}.py")
            with open(script_path, "w") as f:
                f.write(code)
            print(f"[EXECUTOR] Script saved: {script_path}")

            # Execute
            result       = self.executor.run(code, attempt=attempt)
            last_result  = result
            last_run_id  = self.run_id   # snapshot before potential run_id change on next iteration
            self.context.add_result(result.stdout, result.metrics, result.success, attempt=attempt)

            print(f"\n{'✅' if result.success else '❌'} {result.short_summary()}")

            if result.success:
                break
        else:
            print(f"\n⚠️  All {max_retries} attempts failed.")

        # Phase 3: Finalize
        print("\n📖 Storyteller writing final narrative...")
        self.step(
            "storyteller",
            f"Summarize the full analysis and training run. "
            f"{'Training succeeded.' if (last_result and last_result.success) else 'Training failed after all attempts.'} "
            f"Final metrics: {last_result.metrics if last_result else 'N/A'}",
            ROLE_NARRATIVE,
        )

        # Persist
        log_path = os.path.join(experiment_dir, f"context_{self.run_id}.json")
        self.context.save(log_path)
        print(f"\n📄 Context saved to {log_path}")

        if self.memory:
            self.memory.print_stats()
            self.memory.graph_store.print_run(self.run_id)

        return last_result

    def _handle_failure(self, result: ExecutionResult, attempt: int, failed_run_id: str, failed_code_node: str = None):
        failure_summary = (
            f"Training attempt {attempt - 1} FAILED.\n"
            f"Error type : {result.error_type}\n"
            f"Error msg  : {result.error_msg}\n"
            f"Stderr     : {result.stderr[:500]}"
        )

        # Expire all memories from the failed run — agents won't repeat that approach
        if self.memory:
            self.memory.expire_run(failed_run_id)

        da_node = str(uuid.uuid4())[:12]
        print("\n😈 Devil's Advocate re-evaluating after failure...")
        da_response = self.agents["devil_advocate"].run(
            context=self.context.get_context_string(),
            task=f"{failure_summary}\n\nWhat went wrong? Suggest a completely different modeling approach.",
            node_id=da_node,
            run_id=self.run_id,
            role=ROLE_PLAN,
        )
        self.context.add("devil_advocate", ROLE_PLAN, da_response)

        # Graph: failed code node → devil_advocate
        if self.memory and failed_code_node:
            self.memory.graph_store.add_edge(failed_code_node, da_node, FAILURE_LED_TO)
        self._last_node_id = da_node

        print("\n📋 Pragmatist revising the plan...")
        self.step(
            "pragmatist",
            f"{failure_summary}\n\nRevise the plan. Be concrete about what to change.",
            ROLE_PLAN,
        )

    # ------------------------------------------------------------------ #
    # Utilities                                                            #
    # ------------------------------------------------------------------ #

    def save_log(self, path: str = None):
        path = path or f"experiments/context_{self.run_id}.json"
        self.context.save(path)
        print(f"\n📄 Log saved to {path}")

    def print_summary(self):
        self.context.print_summary()
        if self.memory:
            self.memory.print_stats()
