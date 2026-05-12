import os
from providers.base import BaseLLMProvider


def get_provider() -> BaseLLMProvider:
    name = os.getenv("LLM_PROVIDER", "anthropic").lower()
    if name == "anthropic":
        from providers.anthropic_provider import AnthropicProvider
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY is not set.")
        return AnthropicProvider(api_key=api_key)
    if name == "openai":
        from providers.openai_provider import OpenAIProvider
        api_key = os.getenv("OPENAI_API_KEY", "")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not set.")
        return OpenAIProvider(api_key=api_key)
    raise ValueError(f"Unknown LLM_PROVIDER: '{name}'. Use 'anthropic' or 'openai'.")
