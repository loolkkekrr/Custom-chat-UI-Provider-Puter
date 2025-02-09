from flask import Flask, render_template, request, jsonify, send_from_directory
import requests
import json
import os

app = Flask(__name__)
PUTER_API_TOKEN = os.getenv("puter")
# Добавляем обработчик для статических файлов
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory(os.path.join(app.root_path, 'static'), filename)

def call_deepseek_api(user_message, model="deepseek-chat"):
    url = "https://api.puter.com/drivers/call"
    #print(PUTER_API_TOKEN)
    headers = {
        #PUTER_API_TOKEN
        "Authorization": "Bearer " + str(PUTER_API_TOKEN),  # Ваш токен!
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
        "Origin": "https://docs.puter.com"
    }

    payload = {
        "interface": "puter-chat-completion",
        "driver": "deepseek",
        "test_mode": False,
        "method": "complete",
        "args": {
            "messages": [
                {"role": "user", "content": user_message}
            ],
            "model": model
        }
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()

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
    user_message = data.get("message")
    model = data.get("model", "deepseek-chat")

    if not user_message:
        return jsonify({"error": "Сообщение отсутствует"}), 400

    ai_response = call_deepseek_api(user_message, model)
    return jsonify({"response": ai_response})


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)