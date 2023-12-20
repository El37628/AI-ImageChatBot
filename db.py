import os
import firebase_admin
from firebase_admin import credentials, db
from google.cloud import storage
from datetime import datetime, timedelta
from random import choices
import string
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from flask_login import UserMixin
from extension import login_manager
from authlib.jose import jwt

# Firebase Realtime Database credentials and initialization
cred = credentials.Certificate(os.path.join(os.getcwd(), 'FIREBASE_SERVICE_ACCOUNT_JSON'))  # Path to your service account key JSON file
firebase_admin.initialize_app(cred, {
    'databaseURL': 'FIREBASE_REALTIME_DB_URL'
})

cloud_cred = "SERVICE_ACCCOUNT.json" #Cloud Storage Service Account
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = cloud_cred

# Define conversations and currentContainerID as global variables
conversations = {}
currentContainerID = ""

class User(UserMixin):
    def __init__(self, id, username, email, is_active=True, discord_id=None):
        self.id = id
        self.username = username
        self.email = email
        self.active = is_active
        self.discord_id = discord_id

    def is_active(self):
        return self.active

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def get_id(self):
        return self.id

    @staticmethod
    def check_password(password, hashed_password):
        return check_password_hash(hashed_password, password)


    @classmethod
    def get(cls, id):
        ref = db.reference('users')
        user_data = ref.child(id).get()
        if user_data:
            return cls(id=id, username=user_data["username"], email=user_data["email"])
        return None

    @staticmethod
    def create(username, email, password):
        hashed_password = generate_password_hash(password)  # Hash the password before storing
        ref = db.reference('users')
        user_data = {
            'username': username,
            'email': email,
            'password': hashed_password  # Store the hashed password
        }
        user_ref = ref.push(user_data)
        return user_ref.key  # Return the generated ID
    
    @staticmethod
    def create_with_discord(username, email, discord_id):
        ref = db.reference('users')
        user_data = {
            'username': username,
            'email': email,
            'discord_id': discord_id,  # Store the discord_id
        }
        user_ref = ref.push(user_data)
        return user_ref.key  # Return the generated ID
    
    def generate_auth_token(self, expiration=600):
        # current time
        now = datetime.utcnow()
        # preparing token header and payload
        header = {"alg": "HS256"}
        payload = {
            'iat': now,
            'exp': now + timedelta(seconds=expiration),
            'sub': self.id
        }
        # generate token
        token = jwt.encode(header, payload, 'el_yw_520021')
        # return the token as string
        return token.decode('utf-8')



    
    @staticmethod
    def get_by_username(username):
        ref = db.reference('users')
        users_data = ref.get()

        print(f"Searching for username: {username}")
        for user_id, user_data in users_data.items():
            print(f"Found user data: {user_id}, {user_data}")
            if "username" in user_data and user_data["username"] == username:
                print(f"Matched username: {user_data['username']}")
                return User(id=user_id, username=user_data["username"],  email=user_data["email"])

        print(f"No user found for username: {username}")
        return None



    @staticmethod
    def get_by_email(email):
        ref = db.reference('users')
        users = ref.order_by_child('email').equal_to(email).get()
        if users:
            user_id = list(users.keys())[0]
            return users[user_id]
        return None
    
    @staticmethod
    def to_dict(user_data, user_id):
        return {
            'id': user_id,
            'username': user_data.get('username'),
            'password': user_data.get('password'),
            'email': user_data.get('email'),
            'is_active': True  # add this line to include 'is_active' attribute
        }
    
    @staticmethod
    def get_user(username):
        users = db.collection('users')
        docs = users.where('username', '==', username).stream()
        for doc in docs:
            user_id = doc.id
            user_data = doc.to_dict()
            user_data["id"] = user_id  # Include the document ID as 'id'
            return user_data
        return None
    
    @staticmethod
    def verify_auth_token(token):
        try:
            # verify the token
            payload = jwt.decode(token, 'el_yw_520021')
        except jwt.ExpiredSignatureError:
            # the token is expired, return None
            return None
        except jwt.InvalidTokenError:
            # the token is invalid, return None
            return None

        return payload
    
    @classmethod
    def create_with_google(cls, id, email):
        ref = db.reference('users')
        username = email.split('@')[0] if '@' in email else None
        
        # Check if the user with the given google_id already exists
        existing_user_ref = ref.order_by_child('google_id').equal_to(id).limit_to_first(1).get()
        if existing_user_ref:
            # If the user exists, return that user
            user_id = list(existing_user_ref.keys())[0]
            return cls(id=user_id, username=username, email=email)
        
        # If the user doesn't exist, create a new user entry
        user_data = {
            'google_id': id,
            'email': email,
            'username': username
        }
        
        # Pushing the data under a new user_id
        user_ref = ref.child('user_id').child('user').push(user_data)
        
        return cls(id=user_ref.key, username=username, email=email)



@login_manager.user_loader
def load_user(user_id):
    print(f'load_user called with user_id: {user_id}')  # log user_id
    if user_id is None:
        return None
    ref = db.reference('users/' + user_id)
    print(f'Firebase reference: {ref.path}')  # log Firebase reference
    result = ref.get()
    print(f'Firebase result: {result}')  # log Firebase result
    if not result:
        return None
    return User(id=user_id, username=result['username'], email=result['email'])

def load_username(user_id):
    ref = db.reference('users/' + user_id)
    result = ref.get()
    if not result:
        return None
    return result['username']

def upload_to_gcs(user_id, filename, filepath):
    # Replace this with your bucket name
    print("upload_to_gcs function called")  # Add this line
    bucket_name = 'slyvision_str'

    storage_client = storage.Client()
    
    # Get the bucket
    bucket = storage_client.get_bucket(bucket_name)

    # Counter to append to the filename if a file with the same name already exists
    counter = 1

    # Create a blob with the filename
    blob = bucket.blob(secure_filename(filename))

    # Check if a file with the same name already exists
    while bucket.get_blob(secure_filename(filename)):
        filename = f"image_{user_id}_{counter}.png"
        blob = bucket.blob(secure_filename(filename))
        counter += 1


    print(f"Filename: {filename}")
    print(f"Filepath: {filepath}")
    print(f"File exists at path: {os.path.exists(filepath)}")

    # Upload the file
    blob.upload_from_filename(filepath)
    print(f"Uploading file {filename} from {filepath} to bucket {bucket_name}")


    # Create the public URL
    uploaded_url = f"https://storage.googleapis.com/{bucket_name}/{filename}"

    print(f"Generated URL: {uploaded_url}")

    # Delete the local file
    os.remove(filepath)
    

    return uploaded_url



def get_new_conversation_id():
    """
    Generate random conversation_id
    """
    conversation_id = ''.join(choices(['0', '1'], k=2))
    return conversation_id

def get_new_container_id():
    """
    Generate random container_id
    """
    letters_and_digits = string.ascii_letters + string.digits
    container_id = ''.join(choices(letters_and_digits, k=10))
    return container_id

def create_chat_messages_root():
    """
    Create the 'chat_messages' root node if it doesn't exist
    """
    ref = db.reference('/')
    if 'chat_messages' not in ref.get():
        ref.child('chat_messages').set({})


def store_chat_message(container_id, conversation_id, user_input, bot_response, user_id=None):
    try:
        # Ensure user_input and bot_response are lists
        if isinstance(user_input, str):
            user_input = [user_input]
        if isinstance(bot_response, str):
            bot_response = [bot_response]

        # Check if container_id exists in conversations
        if container_id not in conversations:
            conversations[container_id] = {}

        # Check if conversation_id exists in the specific container_id
        if conversation_id not in conversations[container_id]:
            conversations[container_id][conversation_id] = []

        existing_messages = conversations[container_id][conversation_id]

        # Create a new message object for each user input and bot response
        messages = []
        for input_message in user_input:
            # Prevent duplicate user messages
            if not any(
                m.get('content') == input_message and m.get('role') == 'user' for m in existing_messages
            ):
                user_message = {
                    "role": "user",
                    "content": input_message,
                    "timestamp": str(datetime.now())
                }
                messages.append(user_message)
        for response_message in bot_response:
            # Prevent duplicate bot messages
            if not any(
                m.get('content') == response_message and m.get('role') == 'assistant' for m in existing_messages
            ):
                bot_message = {
                    "role": "assistant",
                    "content": response_message,
                    "timestamp": str(datetime.now())
                }
                messages.append(bot_message)

        # Store the messages in the conversation
        conversations[container_id][conversation_id] += messages

        # Update the Firebase Realtime Database with the updated conversation
        ref = db.reference(f'chat_messages/{user_id}/{container_id}/{conversation_id}')
        ref.set(conversations[user_id][container_id][conversation_id])
        print(f"Conversation with user_id {user_id}, container_id {container_id} and conversation_id {conversation_id} saved")

        return {'user_id': user_id, 'container_id': container_id, 'conversation_id': conversation_id}

    except Exception as e:
        print(f"An error occurred while storing chat message: {e}")

def store_generated_image(container_id, conversation_id, image_url, prompt, user_id=None):
    try:
        # Reference to the specific conversation
        ref = db.reference(f'image_generated/{user_id}/{container_id}/{conversation_id}')

        # Fetch existing messages in the conversation
        existing_messages = ref.get() or []

        if prompt:
            user_message = {
                "role": "user",
                "content": prompt,
                "timestamp": str(datetime.now()),
            }
            existing_messages.append(user_message)

        # If image_url is provided, create an image message
        if image_url:
            image_message = {
                "role": "assistant",
                "content": image_url,  # The image URL is used directly here
                "timestamp": str(datetime.now()),
            }

            # Prevent duplicate image messages
            if not any(
                m.get('content') == image_url and m.get('role') == 'assistant' for m in existing_messages
            ):
                existing_messages.append(image_message)

        # Update the Firebase Realtime Database with the updated conversation
        ref.set(existing_messages)
        print(f"Conversation with user_id {user_id}, container_id {container_id} and conversation_id {conversation_id} saved")

        return {'user_id': user_id, 'container_id': container_id, 'conversation_id': conversation_id}

    except Exception as e:
        print(f"An error occurred while storing chat message: {e}")


def fetch_all_user_ids():
    # Reference to the chat_messages node
    ref = db.reference("chat_messages")

    # Get all children under the chat_messages node
    all_users = ref.get()

    if all_users is None:
        return []

    # Return the keys, which are the user IDs
    return list(all_users.keys())

def fetch_image_container_ids(logged_in_user_id):
    # Reference to the chat_messages node
    ref = db.reference(f"image_generated/{logged_in_user_id}")

    # Fetch all children of the chat_messages node
    all_containers = ref.get()
    if all_containers is None:
        return []

    container_ids = []
    for container_id in all_containers.keys():
        # For each container, get all conversation_ids
        conversation_ids = list(all_containers[container_id].keys())
        if conversation_ids:
            # Find the latest timestamp in each conversation
            latest_timestamp = None
            for conversation_id in conversation_ids:
                messages = all_containers[container_id][conversation_id]
                for message in messages:
                    if message is not None:  # Skip None objects
                        timestamp_str = message["timestamp"]
                        timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S.%f")
                        if latest_timestamp is None or timestamp > latest_timestamp:
                            latest_timestamp = timestamp

            # Append the container_id, latest conversation_id, and latest timestamp
            container_ids.append({
                'container_id': container_id,
                'conversation_id': sorted(conversation_ids, reverse=True)[0],
                'timestamp': latest_timestamp
            })

    # Sort the container_ids by timestamp in descending order (latest to oldest)
    container_ids.sort(key=lambda x: x["timestamp"], reverse=True)

    return container_ids

def fetch_generated_images(user_id, container_id, conversation_id):
    # Reference to the specific location where the generated images are stored
    ref = db.reference(f"image_generated/{user_id}/{container_id}/{conversation_id}")
    print(f"Fetching images for user_id: {user_id}, container_id: {container_id}, conversation_id: {conversation_id}") # Debugging print

    # Fetch the messages from the referenced location
    messages = ref.get()
    print(f"Raw messages fetched: {messages}") # Debugging print

    # List to store the formatted images
    formatted_images = []

    if messages:
        for message_data in messages:
            role = message_data["role"]
            content = message_data["content"]
            formatted_image = ""

            if role == "user":
                timestamp_str = message_data["timestamp"]
                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S.%f")
                formatted_timestamp = timestamp.strftime("%b-%d")
                formatted_image = f"{role.capitalize()}: {content} ({formatted_timestamp})"
            elif role == "assistant":
                formatted_image = f"{content}"

            formatted_images.append(formatted_image)

    return formatted_images


def fetch_all_container_ids(logged_in_user_id):
    # Reference to the chat_messages node
    ref = db.reference(f"chat_messages/{logged_in_user_id}")

    # Fetch all children of the chat_messages node
    all_containers = ref.get()
    if all_containers is None:
        return []

    container_ids = []
    for container_id in all_containers.keys():
        # For each container, get all conversation_ids
        conversation_ids = list(all_containers[container_id].keys())
        if conversation_ids:
            # Find the latest timestamp in each conversation
            latest_timestamp = None
            for conversation_id in conversation_ids:
                messages = all_containers[container_id][conversation_id]
                for message in messages:
                    if message is not None:  # Skip None objects
                        timestamp_str = message["timestamp"]
                        timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S.%f")
                        if latest_timestamp is None or timestamp > latest_timestamp:
                            latest_timestamp = timestamp

            # Append the container_id, latest conversation_id, and latest timestamp
            container_ids.append({
                'container_id': container_id,
                'conversation_id': sorted(conversation_ids, reverse=True)[0],
                'timestamp': latest_timestamp
            })

    # Sort the container_ids by timestamp in descending order (latest to oldest)
    container_ids.sort(key=lambda x: x["timestamp"], reverse=True)

    return container_ids



def fetch_chat_messages(container_id, conversation_id, logged_in_user_id):
    ref = db.reference(f"chat_messages/{logged_in_user_id}/{container_id}/{conversation_id}")
    messages = ref.get()

    formatted_messages = []

    if messages:
        for message_data in messages: # No need to iterate over users here
            content = message_data["content"]
            role = message_data["role"]
            timestamp_str = message_data["timestamp"]
            timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S.%f")
            formatted_timestamp = timestamp.strftime("%b-%d")
            formatted_message = f"{role.capitalize()}: {content} ({formatted_timestamp})"
            formatted_messages.append(formatted_message)

    return formatted_messages


def store_user(user_data):
    ref = db.reference('users')
    ref.push(user_data)

def get_user_by_username(username):
    ref = db.reference('users')
    users = ref.order_by_child('username').equal_to(username).get()
    if users:
        # Return the first user found (assuming unique usernames)
        user_id = list(users.keys())[0]
        user_data = users[user_id]
        user_data['id'] = user_id  # Add the user's ID to the returned data
        return user_data
    return None


def get_user_by_google_id(google_id):
    ref = db.reference('users')
    users = ref.order_by_child('google_id').equal_to(google_id).get()
    if users:
        user_id = list(users.keys())[0]
        return users[user_id]
    return None

def get_user_by_discord_id(discord_id):
    ref = db.reference('users')
    users = ref.order_by_child('discord_id').equal_to(discord_id).get()
    if users:
        user_id = list(users.keys())[0]
        return User(id=user_id, username=users[user_id]['username'], email=users[user_id]['email'], discord_id=discord_id)
    return None


def get_user_by_microsoft_id(microsoft_id):
    ref = db.reference('users')
    users = ref.order_by_child('microsoft_id').equal_to(microsoft_id).get()
    if users:
        user_id = list(users.keys())[0]
        return users[user_id]
    return None


# Function to check if a username already exists
def username_exists(username):
    user = get_user_by_username(username)
    return user is not None

# Function to check if an email already exists
def email_exists(email):
    ref = db.reference('users')
    users = ref.order_by_child('email').equal_to(email).get()

    if users:
        return True
    else:
        return False

# Create 'chat_messages' root node if it doesn't exist
create_chat_messages_root()
