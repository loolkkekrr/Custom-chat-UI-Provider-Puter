from flask import Flask, render_template, request, jsonify, send_from_directory
import requests
import json
import os
app = Flask(__name__)
PUTER_API_TOKEN = os.getenv("puter")

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory(os.path.join(app.root_path, 'static'), filename)
# Add this new route to serve the models.json file
@app.route("/models")
def get_models():
    try:
        with open('models.json', 'r') as f:
            models = json.load(f)
            return jsonify(models)
    except Exception as e:
        print(f"Error loading models: {e}")
        return jsonify([]), 500
def call_deepseek_api(messages, provider="openrouter", model="openrouter:anthropic/claude-3.7-sonnet:thinking"):
#def call_deepseek_api(messages, model="deepseek-reasoner"):
    print(PUTER_API_TOKEN)
    url = "https://api.puter.com/drivers/call"
    headers = {
        "Authorization": "Bearer " + str(PUTER_API_TOKEN),
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
        "Origin": "https://docs.puter.com"
    }

    print("МОДЕЛЬ" + model)
    print("ПРОВАЙДЕР:" + provider)
    payload = {
        "interface": "puter-chat-completion",
        "driver": str(provider),
        "test_mode": False,
        "max_tokens": 131072,
        "method": "complete",
        "args": {
            "messages": messages,  # Теперь принимаем полную историю сообщений
            "model": model
        }
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()
        print(result['metadata'])
        return result['result']['message']['content']

    except requests.exceptions.RequestException as e:
        print(f"Request Error: {e}")
        return "Произошла ошибка при обращении к API."
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        print(f"JSON/Data Error: {e}")
        print(f"Response content: {response.text}")
        return "Произошла ошибка при обработке ответа от API."

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    messages = data.get("messages")
    provider = data.get("provider")  # Получаем провайдера
    model = data.get("model")


    if not messages or not isinstance(messages, list):
        return jsonify({"error": "Некорректный формат сообщений"}), 400

    # Проверка структуры каждого сообщения
    for msg in messages:
        if "role" not in msg or "content" not in msg:
            return jsonify({"error": "Каждое сообщение должно содержать role и content"}), 400
        if msg["role"] not in ("user", "assistant"):
            return jsonify({"error": "Недопустимая роль сообщения"}), 400

    ai_response = call_deepseek_api(messages, provider, model)
    return jsonify({"response": ai_response})

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)