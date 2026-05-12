import json
import logging
from flask import Blueprint, request, Response, stream_with_context, current_app
from db import chat as chat_db

logger = logging.getLogger(__name__)

chat_bp = Blueprint("chat", __name__)


@chat_bp.route("/api/chat", methods=["POST"])
def chat():
    body = request.get_json(force=True)
    conv_id = body.get("conversation_id")
    user_text = body.get("message", "").strip()

    logger.info(f"Received chat request for conv_id: {conv_id}")

    if not conv_id or not user_text:
        return {"error": "conversation_id and message are required."}, 400

    # Ensure conversation exists
    conv = chat_db.get_conversation(conv_id)
    if not conv:
        return {"error": f"Conversation '{conv_id}' not found."}, 404

    provider = current_app.config["LLM_PROVIDER"]

    from agent.loop import run

    def event_stream():
        try:
            for event in run(provider, conv_id, user_text):
                yield f"data: {json.dumps(event)}\n\n"
        except GeneratorExit:
            pass
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )
