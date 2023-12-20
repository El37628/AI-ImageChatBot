import random
from datetime import datetime
from db import store_chat_message, conversations, fetch_chat_messages, fetch_all_container_ids, fetch_all_user_ids, load_user
from auth import auth
from img import img
import string
import openai
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, abort
from extension import login_manager
from flask_login import login_required, current_user
from flask_wtf.csrf import CSRFProtect
from concurrent.futures import ThreadPoolExecutor
from itsdangerous import BadSignature, URLSafeTimedSerializer
from feedback import fb

executor = ThreadPoolExecutor(max_workers=5)

app = Flask(__name__, static_url_path='/static')
app.config['SECRET_KEY'] = 'YOUR_SECRET_KEY'
app.config['SESSION_TYPE'] = 'redis'
app.register_blueprint(auth)
app.register_blueprint(img)
app.register_blueprint(fb)
login_manager.init_app(app)
login_manager.login_view="auth.login_page"

serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"])

csrf = CSRFProtect(app)

# Set OpenAI API key
openai.api_key = "YOUR_OPENAI_API_KEY"

memory = []

responses = []


def chat_with_gpt(conversation, conversation_id, container_id):
    # Check if the container_id exists in the conversations dictionary
    if container_id not in conversations:
        conversations[container_id] = {}

    # Check if the conversation ID exists in the container dictionary
    if conversation_id not in conversations[container_id]:
        conversations[container_id][conversation_id] = []

    # GPT-3.5 chat model
    if conversation:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo-16k",
            messages=conversation,
            temperature=0.5,
            max_tokens=1000
        )
        bot_response = response.choices[0].message.content
    else:
        # If there is no previous response, provide a default response
        bot_response = "Hello! How can I assist you today?"

    # Return the AI's response and the updated container_id
    return bot_response, container_id


def get_new_conversation_id():
    letters_and_digits = string.ascii_letters + string.digits
    conversation_id = ''.join(random.choices(letters_and_digits, k=10))
    return conversation_id


def get_new_container_id():
    # This function generates a random string of 10 alphanumeric characters
    letters_and_digits = string.ascii_letters + string.digits
    container_id = ''.join(random.choices(letters_and_digits, k=10))
    return container_id

@app.before_request
def csrf_protect():
    if request.method == "POST":
        # List of routes to exempt from CSRF protection
        exempt_routes = ['/start_new_conversation', '/generate_image', '/new_image', '/chat', '/new_chat', '/get_username', '/synthesize', '/logout', '/login', '/send_feedback', '/callback','/goole-login', '/register']

        # Check if the requested route is in the exempt_routes list
        if request.path not in exempt_routes:
            token = request.form.get("csrf_token")
            if not token or not check_csrf_token(token):
                abort(403)

def check_csrf_token(token):
    try:
        serializer.loads(token, max_age=3600)
    except BadSignature:
        return False
    return True

@app.route("/generate")
def some_form():
    return render_template("img_gen.html", csrf_token=generate_csrf_token())

def generate_csrf_token():
    if "_csrf_token" not in session:
        session["_csrf_token"] = serializer.dumps({})
    return session["_csrf_token"]

@app.route('/')
def index():
    return redirect(url_for('home'))


@app.route('/home')
def home():
    return render_template('homepage.html')


@app.route('/slyvision')
@login_required
def slyvision():
    print("Accessing /slyvision")
    print("User authenticated:", current_user.is_authenticated)
    return render_template('index.html')


@app.route('/img_gen')
@login_required
def img_gen():
    return render_template('img_gen.html')


@app.route('/register_page')
def register_page():
    return render_template('register.html')


@app.route('/login_page')
def login_page():
    return render_template('login.html')

@app.route('/history')
@login_required
def history_page():
    return render_template('history.html')

@app.route('/img_history')
@login_required
def history_img():
    return render_template('img_history.html')


@app.route('/chat', methods=['POST'])
def chat():
    # Get the request data
    data = request.get_json()
    prompt = data.get('prompt')
    conversation_id = data.get('conversation_id')
    container_id = data.get('container_id')
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({"Authentication Error": "user_id is required"}), 401

    # If the prompt is 'new_conversation' and the conversation_id is None,
    # start a new conversation
    if prompt == 'new_conversation' and conversation_id is None:
        # Generate a new ID for the conversation
        conversation_id = get_new_conversation_id()

        # If no container_id was provided, generate a new one
        if container_id is None:
            container_id = get_new_container_id()

        # Initialize the new conversation in the specified container
        if container_id not in conversations:
            conversations[container_id] = {}
        conversations.setdefault(user_id, {})
        conversations[user_id].setdefault(container_id, {})
        conversations[user_id][container_id][conversation_id] = []

        # Return the new IDs in the response
        return jsonify({
            'conversation_id': conversation_id,
            'container_id': container_id,
            'user_id': user_id
        })

    # Otherwise, handle the request as a regular chat message
    else:
        # Check if the container_id and conversation_id are provided
        if not container_id or not conversation_id or not user_id:
            return jsonify({'error': 'user_id, container_id and conversation_id are required'})

        # Find the conversation in the specified container
        if user_id not in conversations or container_id not in conversations[user_id] or conversation_id not in conversations[user_id][container_id]:
            return jsonify({'error': 'Invalid user_id or container_id or conversation_id'})

        conversation = conversations[user_id][container_id][conversation_id]

        # Get the message from the request data
        message = data.get('message')

        if message is None:
            return jsonify({'error': 'message is required'})

        # Add the new user message to the conversation with a timestamp
        conversation.append({
            'role': 'user', 
            'content': message,
            'timestamp': str(datetime.now())
        })

        # Prepare a version of the conversation history without 'timestamp' for the OpenAI API
        openai_conversation = [{'role': m['role'], 'content': m['content']} for m in conversation]

        try:
            # Call chat_with_gpt to get the bot response and updated container_id
            bot_response, container_id = chat_with_gpt(openai_conversation, conversation_id, container_id)

            # Append the newest bot response to the conversation with a timestamp
            conversation.append({
                'role': 'assistant', 
                'content': bot_response,
                'timestamp': str(datetime.now())
            })

            # Store the bot's response immediately
            store_chat_message(container_id, conversation_id, message, [bot_response], user_id)
            print(f'conversation:{conversation}, conversation_id:{conversation_id}, container_id:{container_id}')

            # Return the conversation and other data in the response
            return jsonify({
                'conversation': conversation,
                'conversation_id': conversation_id,
                'container_id': container_id
            })

        except Exception as e:
            print(f"An error occurred while processing the chat message: {e}")

            # Return an error response
            return jsonify({'error': 'An error occurred while processing the chat message.'}), 500


@app.route('/new_chat', methods=['POST'])
def new_chat():
    # Generate a new container ID
    container_id = get_new_container_id()

    # Generate a new conversation ID
    conversation_id = get_new_conversation_id()

    # Initialize a new conversation
    conversation = []


    # Add the new conversation to the conversations dictionary
    if container_id not in conversations:
        conversations[container_id] = {}
    conversations[container_id][conversation_id] = conversation

    # Return the container ID and conversation ID in the response
    return jsonify({'container_id': container_id, 'conversation_id': conversation_id})

@app.route('/chat_messages', methods=['GET'])
def get_chat_messages():
    user_id = request.args.get('user_id')
    container_id = request.args.get('container_id')
    conversation_id = request.args.get('conversation_id')
    
    print(f"user_id: {user_id}, container_id: {container_id}, conversation_id: {conversation_id}")

    if not container_id or not conversation_id or not user_id:
        return jsonify({'error': 'container_id, conversation_id, and user_id are required'}), 400

    messages = fetch_chat_messages(container_id, conversation_id, user_id)
    print(f"messages: {messages}")  # Print the fetched messages
    return jsonify(messages)



@app.route('/get_ids', methods=['GET'])
def get_ids():
    user_id = request.args.get('user_id')
    ids = fetch_all_container_ids(user_id)

    if ids:
        return jsonify(ids)
    else:
        return jsonify({'error': 'No data found for the latest conversation'}), 404


if __name__ == '__main__':
    app.run(debug=True)
