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
        return ChatAnthropic(model=model or "claude-3-5-haiku-20241022", **kwargs)

    if provider == "openai":
        return ChatOpenAI(model=model or "gpt-4o-mini", **kwargs)

    if provider == "local":
        return VLLMOpenAI(
            openai_api_base=base_url or "http://localhost:8000/v1",
            model_name=model or "mistral-7b-instruct",
            openai_api_key="EMPTY",
            **kwargs,
        )

    raise ValueError(f"Unknown provider '{provider}'. Choose from: claude, openai, local")
