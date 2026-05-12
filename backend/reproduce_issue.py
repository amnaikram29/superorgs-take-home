
import os
import json
from dotenv import load_dotenv
from providers.anthropic_provider import AnthropicProvider
from agent.loop import run
from db.schema import init_schema
from db.seed import seed

load_dotenv()

def test_loop():
    init_schema()
    seed()
    
    provider = AnthropicProvider(os.getenv("ANTHROPIC_API_KEY"))
    conv_id = "test-conv"
    user_text = "show mw each years biggest close trend for AAL."
    
    print(f"Testing with query: {user_text}")
    
    for event in run(provider, conv_id, user_text):
        if event["type"] == "tool_start":
            print(f"Tool Start: {event['tool_name']} ({event['call_id']})")
        elif event["type"] == "tool_result":
            print(f"Tool Result: {event['tool_name']} ({event['call_id']})")
        elif event["type"] == "text_delta":
            pass # print(event["content"], end="", flush=True)
        elif event["type"] == "error":
            print(f"\nError: {event['message']}")
        elif event["type"] == "done":
            print(f"\nDone. Message ID: {event['message_id']}")

if __name__ == "__main__":
    test_loop()
