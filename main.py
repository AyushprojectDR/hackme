"""
Multi-Agent Data Science Team
==============================
Usage:
    # Advisory only (no code execution)
    python main.py --dataset data.csv --provider claude --mode manual
    python main.py --dataset data.csv --provider claude --mode auto

    # Full training loop: analyze → generate code → execute → retry on failure
    python main.py --dataset data.csv --provider claude --mode train
    python main.py --dataset data.csv --provider claude --mode train --target SalePrice --retries 4

    # Skip long-term memory (useful for first run / testing)
    python main.py --dataset data.csv --provider claude --mode train --no-memory
"""

import argparse
import os
import pandas as pd

from backends.llm_backends import get_llm
from agents import (
    ExplorerAgent, SkepticAgent, StatisticianAgent, EthicistAgent,
    PragmatistAgent, DevilAdvocateAgent, ArchitectAgent, OptimizerAgent,
    StorytellerAgent, CodeWriterAgent,
)
from agents.planner_agents import PragmatistAgent as FeatureEngineerAgent  # shares base prompt slot
from execution.executor    import CodeExecutor
from memory.agent_memory   import MemorySystem
from orchestration.orchestrator import Orchestrator


EXPERIMENT_DIR = "experiments"


# ------------------------------------------------------------------ #
# Dataset summary                                                      #
# ------------------------------------------------------------------ #

def build_dataset_summary(df: pd.DataFrame) -> str:
    missing = df.isnull().sum()
    missing_summary = missing[missing > 0].to_string() if missing.any() else "None"

    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    cat_cols     = df.select_dtypes(exclude="number").columns.tolist()

    corr_summary = ""
    if len(numeric_cols) > 1:
        corr      = df[numeric_cols].corr()
        pairs     = corr.abs().unstack().sort_values(ascending=False).drop_duplicates()
        top_pairs = pairs[pairs < 1.0].head(5)
        corr_summary = top_pairs.to_string()

    return f"""
Rows       : {len(df)}
Columns    : {len(df.columns)}
Column List: {list(df.columns)}
Numeric    : {numeric_cols}
Categorical: {cat_cols}

Missing Values:
{missing_summary}

Sample (first 3 rows):
{df.head(3).to_string()}

Basic Stats:
{df.describe().to_string()}

Top Correlations:
{corr_summary if corr_summary else 'N/A'}
""".strip()


# ------------------------------------------------------------------ #
# Agent factory                                                        #
# ------------------------------------------------------------------ #

AGENT_NAMES = [
    "explorer", "skeptic", "statistician", "feature_engineer",
    "ethicist", "pragmatist", "devil_advocate", "optimizer",
    "architect", "storyteller", "code_writer",
]

def build_agents(llm) -> dict:
    from prompts.planner_prompts import FEATURE_ENGINEER_PROMPT
    from agents.base import BaseAgent

    return {
        "explorer":         ExplorerAgent(llm),
        "skeptic":          SkepticAgent(llm),
        "statistician":     StatisticianAgent(llm),
        "feature_engineer": BaseAgent("Feature Engineer", FEATURE_ENGINEER_PROMPT, llm),
        "ethicist":         EthicistAgent(llm),
        "pragmatist":       PragmatistAgent(llm),
        "devil_advocate":   DevilAdvocateAgent(llm),
        "optimizer":        OptimizerAgent(llm),
        "architect":        ArchitectAgent(llm),
        "storyteller":      StorytellerAgent(llm),
        "code_writer":      CodeWriterAgent(llm),
    }


# ------------------------------------------------------------------ #
# Entry point                                                          #
# ------------------------------------------------------------------ #

def main():
    parser = argparse.ArgumentParser(description="Multi-Agent Data Science Team")
    parser.add_argument("--dataset",    required=True,        help="Path to CSV dataset")
    parser.add_argument("--provider",   default="claude",     help="LLM provider: claude | openai | local")
    parser.add_argument("--model",      default=None,         help="Model name override")
    parser.add_argument("--base-url",   default=None,         help="Base URL for local vLLM server")
    parser.add_argument("--mode",       default="manual",     help="Pipeline mode: manual | auto | train")
    parser.add_argument("--target",     default=None,         help="Target column name (train mode)")
    parser.add_argument("--retries",    type=int, default=4,  help="Max training retries (train mode)")
    parser.add_argument("--no-memory",  action="store_true",  help="Disable ChromaDB long-term memory")
    parser.add_argument("--save-log",   action="store_true",  help="Save context log to JSON")
    args = parser.parse_args()

    if not os.path.exists(args.dataset):
        print(f"❌ Dataset not found: {args.dataset}")
        return

    os.makedirs(EXPERIMENT_DIR, exist_ok=True)

    print(f"📂 Loading dataset: {args.dataset}")
    df = pd.read_csv(args.dataset)
    dataset_summary = build_dataset_summary(df)

    print(f"\n🔧 Provider : {args.provider}")
    print(f"🔧 Model    : {args.model or 'default'}")
    print(f"🔧 Mode     : {args.mode}")
    print(f"🔧 Memory   : {'disabled' if args.no_memory else 'ChromaDB (experiments/chroma_db)'}")

    llm_kwargs = {}
    if args.base_url:
        llm_kwargs["base_url"] = args.base_url

    llm    = get_llm(args.provider, model=args.model, **llm_kwargs)
    agents = build_agents(llm)

    # Memory system (per-agent ChromaDB + SQLite graph)
    memory_system = None
    if not args.no_memory:
        memory_system = MemorySystem(
            agent_names=AGENT_NAMES,
            persist_dir=os.path.join(EXPERIMENT_DIR, "chroma_db"),
            graph_db=os.path.join(EXPERIMENT_DIR, "graph.db"),
        )

    orch_llm = llm if args.mode == "auto" else None
    executor = CodeExecutor(work_dir=EXPERIMENT_DIR) if args.mode == "train" else None

    orchestrator = Orchestrator(
        agents=agents,
        llm=orch_llm,
        executor=executor,
        memory_system=memory_system,
    )

    if args.mode == "manual":
        orchestrator.run_manual(dataset_summary)

    elif args.mode == "auto":
        orchestrator.run_auto(dataset_summary)

    elif args.mode == "train":
        orchestrator.run_training_loop(
            dataset_summary=dataset_summary,
            dataset_path=os.path.abspath(args.dataset),
            target_col=args.target,
            max_retries=args.retries,
            experiment_dir=EXPERIMENT_DIR,
        )

    else:
        print(f"❌ Unknown mode '{args.mode}'. Use: manual | auto | train")
        return

    if args.save_log:
        orchestrator.save_log()

    orchestrator.print_summary()
    print("\n✅ Done!")


if __name__ == "__main__":
    main()
