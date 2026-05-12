from flask import Blueprint, request, jsonify
from db import chat as chat_db

conv_bp = Blueprint("conversations", __name__)


@conv_bp.route("/api/conversations", methods=["GET"])
def list_conversations():
    convs = chat_db.list_conversations()
    return jsonify(convs)


@conv_bp.route("/api/conversations", methods=["POST"])
def create_conversation():
    body = request.get_json(force=True) or {}
    title = body.get("title")
    conv = chat_db.create_conversation(title)
    return jsonify(conv), 201


@conv_bp.route("/api/conversations/<conv_id>", methods=["GET"])
def get_conversation(conv_id: str):
    conv = chat_db.get_conversation(conv_id)
    if not conv:
        return {"error": "Not found."}, 404
    return jsonify(conv)


@conv_bp.route("/api/conversations/<conv_id>/messages", methods=["GET"])
def get_messages(conv_id: str):
    conv = chat_db.get_conversation(conv_id)
    if not conv:
        return {"error": "Not found."}, 404
    messages = chat_db.get_messages(conv_id)
    return jsonify(messages)
