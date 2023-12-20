import openai
from flask import Blueprint, render_template, request, jsonify, Response
import logging
import os
import requests
import base64
from db import upload_to_gcs, store_generated_image, conversations, fetch_generated_images, fetch_image_container_ids
import string
import random
import json

logging.basicConfig(filename='debug.log', level=logging.DEBUG)

img = Blueprint('img', __name__)
openai.api_key = "YOUR_OPENAI_API_KEY"

@img.route('/')
def img_gen():
    return render_template('img_gen.html')

def generate_unique_filename(user_id, counter):
    while True:
        filename = f"image_{user_id}_{counter}.png"
        filepath = os.path.join("static", "images", filename)
        if not os.path.exists(filepath):
            return filename, filepath


@img.route('/generate_image', methods=['POST'])
def generate_image_route():
    data = request.get_json()
    prompt = data['prompt']
    num_image = int(data.get('num_image', 1))
    size = data.get('size', '256x256')

    user_id = data.get('user_id')
    container_id = data.get('container_id')
    conversation_id = data.get('conversation_id')

    image_urls = generate_image(prompt, num_image, size)
    print("Generated image URLs:", image_urls)

    base64_images = []  # List to hold base64 encoded images
    public_image_urls = [] # List to hold the public URLs of the images

    counter = 1
    for image_url in image_urls:
        print("Image URLs:", image_urls)
        filename, filepath = generate_unique_filename(user_id, counter)  # Unpack the tuple here

        response = requests.get(image_url)
        print(f"Downloading image {image_url}...")

        with open(filepath, "wb") as f:
            f.write(response.content)
            print(f"Downloaded {len(response.content)} bytes.")

        print(f"Saving to file {filepath}...")
        print("Response status code:", response.status_code)

        # Read the file and convert to base64
        with open(filepath, "rb") as f:
            base64_image = base64.b64encode(f.read()).decode('utf-8')
            base64_images.append(base64_image)

        # Upload to Google Cloud Storage and get the public URL
        public_url = upload_to_gcs(user_id, filename, filepath)
        public_image_urls.append(public_url)
        counter += 1

    # Store the generated image URL in Firebase Realtime Database
    for image_url in public_image_urls:
        if conversation_id and container_id and image_url:
            store_generated_image(container_id, conversation_id, image_url, prompt, user_id)
            new_conversation_id = get_new_conversation_id()
            conversation_id = new_conversation_id

    return jsonify({'image_url': base64_images})  # Return the base64 encoded images


def generate_image(prompt, num_image=1, size='256x256', output_format='url'):
    try:
        images = []
        response = openai.Image.create(
            model='dall-e-2',
            prompt=prompt,
            n=num_image,
            size=size,
            response_format=output_format
        )
        if output_format == 'url':
            for image in response['data']:
                images.append(image['url'])
        elif output_format == 'b64_json':
            for image in response['data']:
                images.append(image['b64_json'])
        return images
    except Exception as e:
        print(e)


def get_new_conversation_id():
    letters_and_digits = string.ascii_letters + string.digits
    conversation_id = ''.join(random.choices(letters_and_digits, k=10))
    return conversation_id


def get_new_container_id():
    # This function generates a random string of 10 alphanumeric characters
    letters_and_digits = string.ascii_letters + string.digits
    container_id = ''.join(random.choices(letters_and_digits, k=10))
    return container_id

@img.route('/start_new_conversation', methods=['POST'])
def start_new_conversation():
    try:
        data = request.get_data(as_text=True)
        print(f"Received data: {data}")
        # Parse the JSON data manually
        data = json.loads(data)

        prompt = 'new_conversation'
        conversation_id = data.get('conversation_id')
        container_id = data.get('container_id')

        if prompt == 'new_conversation' and conversation_id is None:
            # If no conversation_id was provided, generate a new one
            if conversation_id is None:
                conversation_id = get_new_conversation_id()

            # If no container_id was provided, generate a new one
            if container_id is None:
                container_id = get_new_container_id()

            # Log the generated conversation_id and container_id
            logging.debug(f'Generated conversation_id: {conversation_id}')
            logging.debug(f'Generated container_id: {container_id}')

            # Initialize the new conversation in the specified container
            if container_id not in conversations:
                conversations[container_id] = {}
            conversations[container_id][conversation_id] = []

            store_generated_image(container_id, conversation_id, None, None, None)

            # Log the response data
            response_data = {
                'conversation_id': conversation_id,
                'container_id': container_id,
            }
            logging.debug(f'Response data: {response_data}')

            # Return the new IDs in the response
            return jsonify(response_data)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@img.route('/new_image', methods=['POST'])
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

@img.route('/images', methods=['GET'])
def get_generated_image():
    user_id = request.args.get('user_id')
    container_id = request.args.get('container_id')
    conversation_id = request.args.get('conversation_id')

    print(f"user_id: {user_id}, container_id: {container_id}, conversation_id: {conversation_id}")

    if not container_id or not conversation_id or not user_id:
        return jsonify({'error': 'Invalid request'}), 400
    
    messages = fetch_generated_images(user_id, container_id, conversation_id)
    print(f"messages: {messages}")
    return jsonify(messages)

@img.route('/get_img_ids', methods=['GET'])
def get_img_ids():
    user_id = request.args.get('user_id')
    ids = fetch_image_container_ids(user_id)

    if ids:
        return jsonify(ids)
    else:
        return jsonify({'error': 'No data found for the latest conversation'}), 404
    
@img.route('/download_image', methods=['GET'])
def download_image():
    image_url = request.args.get('image_url')
    
    if not image_url:
        return jsonify({'error': 'No image URL provided'}), 400

    response = requests.get(image_url, stream=True)

    if response.status_code != 200:
        return jsonify({'error': 'Image not found'}), 404

    # Get the filename from the URL
    filename = image_url.split('/')[-1]

    # Set the headers to force download
    headers = {
        'Content-Disposition': f'attachment; filename={filename}',
        'Content-Type': response.headers.get('Content-Type', 'application/octet-stream')
    }

    return Response(response.content, headers=headers)
