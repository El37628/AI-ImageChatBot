from flask import Blueprint, request, jsonify
import requests

fb = Blueprint('fb', __name__)

@fb.route('/send_feedback', methods=['POST'])
def send_feedback():
    username = request.form['username']
    feedback = request.form['feedback']

    # Prepare the data for the Discord webhook
    discord_webhook_url = 'WEBHOOK_URL'
    data = {
        "content": f"Username: {username}\nFeedback: {feedback}"
    }

    # Send the feedback to the Discord webhook
    response = requests.post(discord_webhook_url, json=data)

    # Check for successful submission to Discord
    if response.status_code == 204:
        return jsonify(success=True), 200
    else:
        return jsonify(success=False), 500
