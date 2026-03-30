# Agent System - Mermaid Diagrams

## Agent Team Collaboration

```mermaid
graph TB
    subgraph EDA["🔍 EDA Team (Understanding)"]
        Explorer["📊 Explorer<br/>(Optimistic)"]
        Skeptic["⚠️ Skeptic<br/>(Critical)"]
        Statistician["📈 Statistician<br/>(Rigorous)"]
        Ethicist["⚖️ Ethicist<br/>(Cautious)"]
    end

    subgraph Planning["📋 Planning Team (Designing)"]
        FeatEng["🔧 Feature Engineer<br/>(Inventive)"]
        Pragmatist["🎯 Pragmatist<br/>(Results-driven)"]
        DevAdv["🚫 Devil's Advocate<br/>(Contrarian)"]
        Optimizer["⚙️ Optimizer<br/>(Performance)"]
    end

    subgraph Execution["💻 Execution Team (Building)"]
        CodeWriter["💻 CodeWriter<br/>(Precise)"]
        Architect["🏗️ Architect<br/>(Systems)"]
        Storyteller["📖 Storyteller<br/>(Narrative)"]
    end

    subgraph Meta["🤖 Meta Agents"]
        Builder["BuilderAgent<br/>(Auto-tools)"]
        Installer["LibraryInstaller<br/>(Auto-fix)"]
    end

    EDA -->|Context| Planning
    Planning -->|Plan| Execution
    Builder -->|Creates| Meta
    Installer -->|Fixes| Meta

    style EDA fill:#e1f5ff
    style Planning fill:#f3e5f5
    style Execution fill:#e8f5e9
    style Meta fill:#fff3e0
```

## Agent Lifecycle

```mermaid
graph LR
    Start([Start]) --> Recall["1️⃣ RECALL<br/>Search Memory<br/>55% BM25<br/>45% Vector"]

    Recall --> Context["2️⃣ BUILD CONTEXT<br/>Dataset + Goal<br/>Previous outputs<br/>Error context"]

    Context --> Inject["3️⃣ INJECT PERSONALITY<br/>Activity level<br/>Stance<br/>Sentiment bias"]

    Inject --> Think["4️⃣ LLM INFERENCE<br/>Claude processes<br/>Agent thinks<br/>Generates output"]

    Think --> Store["5️⃣ STORE MEMORY<br/>Tag success/failure<br/>Add to knowledge graph<br/>Temporal decay"]

    Store --> Check{Success?}

    Check -->|Yes| End([Complete])
    Check -->|No| Retry["Retry #2<br/>with error context"]
    Retry --> Recall

    style Recall fill:#e3f2fd
    style Context fill:#f3e5f5
    style Inject fill:#fce4ec
    style Think fill:#fff3e0
    style Store fill:#e8f5e9
    style Check fill:#ffebee
```

## Phase-Based Pipeline

```mermaid
graph TD
    Input["📥 INPUT<br/>Dataset + Task"] --> P1["<b>PHASE 1: DATA UNDERSTANDING</b><br/>━━━━━━━━━━━━━━━━━<br/>BuilderAgent analyzes<br/>Explorer: Patterns<br/>Skeptic: Quality issues<br/>Statistician: Validation<br/>Ethicist: Bias check"]

    P1 --> P2["<b>PHASE 2: MODEL DESIGN</b><br/>━━━━━━━━━━━━━━━━━<br/>Feature Engineer: New features<br/>Pragmatist: Model plan<br/>Devil's Advocate: Challenges<br/>Optimizer: Tuning strategy"]

    P2 --> P3["<b>PHASE 3: CODE GENERATION</b><br/>━━━━━━━━━━━━━━━━━<br/>CodeWriter: Generate script<br/>Execute: Run as subprocess<br/>Retry loop up to 4x<br/>Auto library install"]

    P3 --> P4["<b>PHASE 4: VALIDATION</b><br/>━━━━━━━━━━━━━━━━━<br/>Skeptic: Find problems<br/>Devil's Advocate: Edge cases<br/>Statistician: Statistical checks"]

    P4 --> P5["<b>PHASE 5: INFERENCE</b><br/>━━━━━━━━━━━━━━━━━<br/>CodeWriter: Inference script<br/>Architect: Deployment<br/>Storyteller: Final narrative"]

    P5 --> Output["📤 OUTPUT<br/>Model + Report"]

    style P1 fill:#e3f2fd
    style P2 fill:#f3e5f5
    style P3 fill:#e8f5e9
    style P4 fill:#fce4ec
    style P5 fill:#fff3e0
```

## Retry Mechanism - Error Recovery

```mermaid
graph TD
    Error["❌ ERROR"] --> Check1{"Layer 1:<br/>ImportError?"}

    Check1 -->|YES| Installer["[LibraryInstaller]<br/>pip install package<br/>Retry same script"]
    Installer -->|Success| End1["✅ Continue"]
    Installer -->|Still fails| Check2

    Check1 -->|NO| Check2{"Layer 2:<br/>Tool validation?"}

    Check2 -->|YES| ToolVal["[ToolValidator]<br/>Syntax → Compile → Import<br/>LLM fixes code<br/>Retry validation"]
    ToolVal -->|Success| End2["✅ Continue"]
    ToolVal -->|Still fails| Check3

    Check2 -->|NO| Check3{"Layer 3:<br/>Agent error?"}

    Check3 -->|YES| AgentRetry["[Orchestrator]<br/>Inject error context<br/>Retry agent<br/>Up to 2x"]
    AgentRetry -->|Success| End3["✅ Continue"]
    AgentRetry -->|Still fails| Check4

    Check3 -->|NO| Check4{"Layer 4:<br/>Training failed?"}

    Check4 -->|YES| CodeGenLoop["[Layer 5: Code Gen Loop]<br/>Up to 4 attempts"]

    CodeGenLoop --> Attempt1["Attempt 1:<br/>CodeWriter generates<br/>Execute"]
    Attempt1 -->|Fail| Expire["Expire memories<br/>Don't repeat mistake"]
    Expire --> Attempt2["Attempt 2:<br/>Devil's Advocate<br/>re-evaluates<br/>Pragmatist redesigns<br/>New code, fresh run_id"]
    Attempt2 -->|Fail| Attempt3["Attempt 3:<br/>Different strategy<br/>New design"]
    Attempt3 -->|Fail| Attempt4["Attempt 4:<br/>Last try"]
    Attempt4 -->|Fail| GiveUp["Give up<br/>Output best attempt"]
    Attempt1 -->|Success| End4["✅ Continue"]
    Attempt2 -->|Success| End4
    Attempt3 -->|Success| End4
    Attempt4 -->|Success| End4

    style Error fill:#ffcdd2
    style Check1 fill:#fff9c4
    style Installer fill:#c8e6c9
    style End1 fill:#a5d6a7
    style CodeGenLoop fill:#ffccbc
```

## Memory System - 3 Layers

```mermaid
graph TB
    Current["Current Run"] --> WM["<b>Layer 1: WORKING MEMORY</b><br/>━━━━━━━━━━━━━━━━━<br/>Timeline of this run<br/><br/>📌 [Pinned] Dataset<br/>📌 [Pinned] Task/Goal<br/>↓<br/>[Agent 1] Output<br/>[Agent 2] Output<br/>[Agent 3] Output<br/>↓<br/>Token overflow?<br/>→ LLM compaction"]

    WM -->|Saved after each step| LTM["<b>Layer 2: LONG-TERM MEMORY</b><br/>━━━━━━━━━━━━━━━━━<br/>ChromaDB (per agent)<br/><br/>📊 Success: PCA+XGBoost<br/>   Score: 0.94<br/>   Age: 90d decay<br/><br/>❌ Failed: Deep learning<br/>   Error: OOM<br/>   Status: EXPIRED<br/>   Age: 3d decay<br/><br/>📊 Success: LightGBM<br/>   Improvement: +0.02<br/><br/>Search: 55% BM25<br/>        45% Vector<br/>        + MMR ranking"]

    LTM -->|Indexed for lineage| KG["<b>Layer 3: KNOWLEDGE GRAPH</b><br/>━━━━━━━━━━━━━━━━━<br/>SQLite (system-wide)<br/><br/>[Explorer] node<br/>   ↓ INFORMED_BY<br/>[Skeptic] node<br/>   ↓ INFORMED_BY<br/>[Pragmatist] node<br/>   ↙ ↓ ↘<br/>RETRY   INFORMED  FAILURE<br/>  │       BY        LEDTO<br/>  ↓       ↓          ↓<br/>Attempt  CodeWr  DevAdv<br/>  2       node    node<br/><br/>Edge types:<br/>INFORMED_BY (A→B)<br/>RETRY_OF (retry attempt)<br/>FAILURE_LED_TO (recovery)<br/>CROSS_RUN (across runs)"]

    style WM fill:#e3f2fd
    style LTM fill:#f3e5f5
    style KG fill:#fff9c4
```

## Behavioral Personality Space

```mermaid
graph TB
    subgraph Config["AGENT BEHAVIORAL CONFIG"]
        Activity["Activity Level<br/>0 = Silent<br/>1 = Verbose"]
        Stance["Stance<br/>Supportive<br/>Opposing<br/>Neutral<br/>Observer"]
        Sentiment["Sentiment Bias<br/>-1 = Critical<br/>0 = Neutral<br/>+1 = Constructive"]
    end

    Config --> Explorer["<b>EXPLORER</b><br/>━━━━━━<br/>Activity: 0.9<br/>Stance: Supportive<br/>Sentiment: +0.6<br/>Insight: True<br/><br/>✨ Thorough<br/>✨ Optimistic<br/>✨ Constructive"]

    Config --> Skeptic["<b>SKEPTIC</b><br/>━━━━━━<br/>Activity: 0.7<br/>Stance: Opposing<br/>Sentiment: -0.7<br/>Insight: False<br/><br/>⚡ Aggressive<br/>⚡ Critical<br/>⚡ Concise"]

    Config --> Pragmatist["<b>PRAGMATIST</b><br/>━━━━━━<br/>Activity: 0.8<br/>Stance: Neutral<br/>Sentiment: 0<br/>Insight: True<br/><br/>🎯 Balanced<br/>🎯 Action-oriented<br/>🎯 Results-focused"]

    Config --> DevAdv["<b>DEVIL'S ADVOCATE</b><br/>━━━━━━<br/>Activity: 0.9<br/>Stance: Opposing<br/>Sentiment: -0.8<br/><br/>🔴 Maximally<br/>🔴 Contrarian<br/>🔴 Provocative"]

    style Config fill:#fffde7
    style Explorer fill:#c8e6c9
    style Skeptic fill:#ffccbc
    style Pragmatist fill:#bbdefb
    style DevAdv fill:#f8bbd0
```

## Orchestration Modes

```mermaid
graph TD
    Start["🎯 INPUT<br/>Dataset + Task"] --> Mode{Choose Mode}

    Mode -->|Read-only| Manual["<b>MANUAL MODE</b><br/>━━━━━━━━━━━<br/>FIXED sequence:<br/>1. Explorer<br/>2. Skeptic<br/>3. Pragmatist<br/>4-7. [repeat]<br/>Last: Storyteller<br/><br/>❌ No code execution<br/>✅ Advisory only"]

    Mode -->|Let LLM decide| Auto["<b>AUTO MODE</b><br/>━━━━━━━━━━<br/>DYNAMIC sequence:<br/>Orchestrator LLM:<br/>'Who goes next?'<br/><br/>Could be:<br/>• CodeWriter<br/>• Devil's Advocate<br/>• Feature Engineer<br/>• Storyteller<br/><br/>Adaptive & flexible"]

    Mode -->|Full pipeline| Phases["<b>PHASES MODE</b><br/>━━━━━━━━━━<br/>5 independent phases:<br/><br/>Phase 1: Data Understanding<br/>Phase 2: Model Design<br/>Phase 3: Code Generation<br/>Phase 4: Validation<br/>Phase 5: Inference<br/><br/>✅ Full autonomy<br/>✅ Code execution<br/>✅ Re-runnable phases"]

    Manual --> Output["📤 Analysis Report<br/>(no trained model)"]
    Auto --> Output
    Phases --> Output2["📤 Model + Report<br/>(fully trained)"]

    style Manual fill:#e3f2fd
    style Auto fill:#f3e5f5
    style Phases fill:#e8f5e9
```

