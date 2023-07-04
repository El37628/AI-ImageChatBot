import firebase_admin
from firebase_admin import credentials, db
from datetime import datetime

# Firebase Realtime Database credentials and initialization
cred = credentials.Certificate('credential_key.json')  # Path to your service account key JSON file
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://slyvision-5473f-default-rtdb.asia-southeast1.firebasedatabase.app/'  # Replace with your Firebase Realtime Database URL
})

# Define conversations as a global variable
conversations = {}

def store_chat_message(conversation_id, user_input, bot_response, chat_topic):
    try:
        # Ensure user_input and bot_response are lists
        if isinstance(user_input, str):
            user_input = [user_input]
        if isinstance(bot_response, str):
            bot_response = [bot_response]

        # Check if conversation_id exists in conversations
        if conversation_id not in conversations:
            conversations[conversation_id] = []

        existing_messages = conversations[conversation_id]

        # Create a new message object for each user input and bot response
        messages = []
        for input_message in user_input:
            # Prevent duplicate user messages
            if not any(m.get('content') == input_message and m.get('role') == 'user' for m in existing_messages):
                user_message = {"role": "user", "content": input_message, "timestamp": str(datetime.now())}
                messages.append(user_message)
        for response_message in bot_response:
            # Prevent duplicate bot messages
            if not any(m.get('content') == response_message and m.get('role') == 'assistant' for m in existing_messages):
                bot_message = {"role": "assistant", "content": response_message, "timestamp": str(datetime.now())}
                messages.append(bot_message)

        # Add the chat topic to the first message
        if messages:
            messages[0]["chat_topic"] = chat_topic

        # Store the messages in the conversation
        conversations[conversation_id] += messages

        # Update the Firebase Realtime Database with the updated conversation
        ref = db.reference(f'chat_messages/{conversation_id}')
        ref.set(conversations[conversation_id])
        print(f"Conversation with conversation_id {conversation_id} saved")
    except Exception as e:
        print(f"An error occurred while storing chat message: {e}")



def fetch_chat_history(conversation_id):
    try:
        ref = db.reference(f'chat_messages/{conversation_id}')
        chat_messages = ref.get()

        chat_history_list = []
        if chat_messages:
            if isinstance(chat_messages, dict):
                sorted_messages = sorted(chat_messages.values(), key=lambda x: x.get('timestamp', ''))
                for message in sorted_messages:
                    if 'content' in message:
                        user_message = {
                            'role': 'user',
                            'conversation_id': conversation_id,
                            'content': message['content'],
                            'last_updated': message.get('timestamp')
                        }
                        chat_history_list.append(user_message)

                    if 'content' in message and 'role' in message and message['role'] == 'assistant':
                        bot_message = {
                            'role': 'assistant',
                            'conversation_id': conversation_id,
                            'content': message['content'],
                            'last_updated': message.get('timestamp')
                        }
                        chat_history_list.append(bot_message)
            elif isinstance(chat_messages, list):
                for message in chat_messages:
                    if 'content' in message and 'role' in message and message['role'] == 'user':
                        user_message = {
                            'role': 'user',
                            'conversation_id': conversation_id,
                            'content': message['content'],
                            'last_updated': message.get('timestamp')
                        }
                        chat_history_list.append(user_message)

                    if 'content' in message and 'role' in message and message['role'] == 'assistant':
                        bot_message = {
                            'role': 'assistant',
                            'conversation_id': conversation_id,
                            'content': message['content'],
                            'last_updated': message.get('timestamp')
                        }
                        chat_history_list.append(bot_message)

        return chat_history_list
    except Exception as e:
        print(f"An error occurred while fetching chat history: {e}")
        return None
