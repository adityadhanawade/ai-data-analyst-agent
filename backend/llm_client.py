"""Thin wrapper around the LLM so agent.py doesn't care which provider is
behind it. Right now this calls Google Gemini's free tier (for local
development/testing). For the actual hackathon submission we'll swap this
to call AWS Bedrock instead - only this file will need to change."""

import os
import warnings
from google import genai
from google.genai import types

warnings.filterwarnings("ignore", message="Direct use of automatic function calling")

_client = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Add it to backend/.env"
            )
        _client = genai.Client(api_key=api_key)
    return _client


def ask_llm(system_prompt: str, user_prompt: str, max_tokens: int = 2048) -> str:
    client = _get_client()
    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            max_output_tokens=max_tokens,
        ),
    )
    if not response.text:
        raise RuntimeError(
            f"Gemini returned no text (finish_reason: "
            f"{response.candidates[0].finish_reason if response.candidates else 'unknown'}). "
            "This usually means the output got cut off - try increasing max_tokens."
        )
    return response.text
