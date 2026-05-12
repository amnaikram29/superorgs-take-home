import logging
from flask import Blueprint, request, jsonify
from db import chat as chat_db

logger = logging.getLogger(__name__)

conv_bp = Blueprint("conversations", __name__)


@conv_bp.route("/api/conversations", methods=["GET"])
def list_conversations():
    logger.info("Listing all conversations")
    convs = chat_db.list_conversations()
    return jsonify(convs)


@conv_bp.route("/api/conversations", methods=["POST"])
def create_conversation():
    body = request.get_json(force=True) or {}
    title = body.get("title")
    logger.info(f"Creating new conversation with title: {title}")
    conv = chat_db.create_conversation(title)
    return jsonify(conv), 201


@conv_bp.route("/api/conversations/<conv_id>", methods=["GET"])
def get_conversation(conv_id: str):
    logger.info(f"Fetching conversation: {conv_id}")
    conv = chat_db.get_conversation(conv_id)
    if not conv:
        logger.warning(f"Conversation not found: {conv_id}")
        return {"error": "Not found."}, 404
    return jsonify(conv)


@conv_bp.route("/api/conversations/<conv_id>/messages", methods=["GET"])
def get_messages(conv_id: str):
    logger.info(f"Fetching messages for conversation: {conv_id}")
    conv = chat_db.get_conversation(conv_id)
    if not conv:
        logger.warning(f"Conversation not found: {conv_id}")
        return {"error": "Not found."}, 404
    messages = chat_db.get_messages(conv_id)
    return jsonify(messages)
