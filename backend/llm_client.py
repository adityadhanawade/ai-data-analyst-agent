"""Thin wrapper around the Claude API so agent.py doesn't care whether we're
calling Anthropic directly (now, for local testing) or AWS Bedrock (later,
for the hackathon submission). Only this file needs to change to switch."""

import os
from anthropic import Anthropic

_client = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set. Copy backend/.env.example to "
                "backend/.env and fill in your key."
            )
        _client = Anthropic(api_key=api_key)
    return _client


def ask_claude(system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> str:
    client = _get_client()
    response = client.messages.create(
        model="claude-sonnet-5",
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return response.content[0].text
