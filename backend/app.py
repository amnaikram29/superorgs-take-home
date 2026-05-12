import os
from dotenv import load_dotenv

load_dotenv()

from flask import Flask
from flask_cors import CORS

from db.schema import init_schema
from db.seed import seed
from config import get_provider
from routes.chat import chat_bp
from routes.conversations import conv_bp


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    # Initialize DB schema and seed data
    init_schema()
    seed()

    # Instantiate the LLM provider once and share via app config
    provider = get_provider()
    app.config["LLM_PROVIDER"] = provider

    # Register blueprints
    app.register_blueprint(chat_bp)
    app.register_blueprint(conv_bp)

    @app.route("/health")
    def health():
        return {"status": "ok"}

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
