import os
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_community.llms import VLLMOpenAI


def get_llm(provider: str, model: str = None, base_url: str = None, **kwargs):
    """
    Returns a LangChain-compatible LLM.

    Providers:
        claude : Anthropic Claude  (requires ANTHROPIC_API_KEY)
        openai : OpenAI            (requires OPENAI_API_KEY)
        local  : Local vLLM server (requires base_url or VLLM_URL env var)
    """
    if provider == "claude":
        api_key = os.getenv("ANTHROPIC_API_KEY")
        return ChatAnthropic(
            model=model or "claude-3-5-haiku-20241022",
            api_key=api_key,
            **kwargs
        )

    if provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        return ChatOpenAI(
            model=model or "gpt-4o-mini",
            api_key=api_key,
            **kwargs
        )

    if provider == "local":
        vllm_url = base_url or os.getenv("VLLM_URL") or "http://localhost:8000/v1"
        vllm_model = model or os.getenv("VLLM_MODEL") or "mistral-7b-instruct"
        return VLLMOpenAI(
            openai_api_base=vllm_url,
            model_name=vllm_model,
            openai_api_key="EMPTY",
            **kwargs,
        )

    raise ValueError(f"Unknown provider '{provider}'. Choose from: claude, openai, local")
