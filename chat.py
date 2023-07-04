import queue
import re
import sys
import base64
from google.cloud import speech
import azure.cognitiveservices.speech as speechsdk
import pyaudio
import openai
from flask import Flask, render_template, request, jsonify, session
import spacy
import random
from datetime import datetime
from db import store_chat_message, fetch_chat_history
import subprocess
import string
from flask_wtf.csrf import CSRFProtect
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import declarative_base

nlp = spacy.load("en_core_web_sm")

executor = ThreadPoolExecutor(max_workers=5)

# Initialize speech API key and region
speech_key = "958194afd0b344e5a110135184f7e762"
service_region = "southeastasia"

# Define key and region
speech_config = speechsdk.SpeechConfig(subscription=speech_key, region=service_region)
speech_config.speech_synthesis_voice_name = "en-US-MonicaNeural"

# Use the default speaker as audio output.
speech_synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config)

app = Flask(__name__)
app.debug = True
app.config['SECRET_KEY'] = 'El520021'
app.config['SESSION_TYPE'] = 'filesystem'
csrf = CSRFProtect(app)

# Set OpenAI API key
openai.api_key = "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"

# Audio recording parameters
RATE = 16000
CHUNK = int(RATE / 10)  # 100ms

memory = []
summary_sentence = None
conversations = {}


def extract_noun_phrases(text):
    doc = nlp(text)
    noun_phrases = [chunk.text for chunk in doc.noun_chunks]
    return noun_phrases


def generate_chat_topic(user_input, bot_previous_response):
    global summary_sentence

    # Return the existing topic if it has already been set
    if summary_sentence is not None:
        return summary_sentence

    user_noun_phrases = extract_noun_phrases(user_input)
    bot_noun_phrases = extract_noun_phrases(bot_previous_response)

    all_noun_phrases = user_noun_phrases + bot_noun_phrases

    # Generate a summary sentence from the noun phrases
    noun_phrases_summary = ' '.join(all_noun_phrases[:5])  # Concatenate the first 5 noun phrases
    summary_sentence = noun_phrases_summary.capitalize() + "."

    # If the generated sentence is too short, add more random words from the noun phrases
    if len(summary_sentence.split()) < 5:
        additional_words = random.sample(all_noun_phrases[5:], k=min(2, len(all_noun_phrases[5:])))
        summary_sentence += " " + ' '.join(additional_words)

    return summary_sentence if summary_sentence else "No clear topic found"


def chat_with_gpt(prompt, conversation, conversation_id):
    global memory

    conversation.extend(conversations.get(conversation_id, []))

    user_input = prompt

    conversation.append({'role': 'user', 'content': user_input})

    bot_previous_response = conversation[-2]['content'] if len(conversation) >= 2 else ""
    chat_topic = generate_chat_topic(prompt, bot_previous_response)

    # GPT-3.5 chat model
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo-16k",
        messages=conversation,
        temperature=0.2,
        max_tokens=300
    )

    bot_response = response.choices[0].message.content
    displayed_bot_response = bot_response
    conversation.extend([
        {'role': 'assistant', 'content': displayed_bot_response}
    ])

    unique_messages = []
    for message in conversation:
        if not unique_messages or message != unique_messages[-1]:
            unique_messages.append(message)
    memory = unique_messages

    # Debugging: Print the conversation before and after storing in the dictionary
    print(f"Conversation before update: {conversations.get(conversation_id, [])}")
    existing_conversation = conversations.get(conversation_id, [])
    conversations[conversation_id] = existing_conversation + conversation[len(existing_conversation):]
    print(f"Conversation after update: {conversations[conversation_id]}")


    # Store the conversation data after getting the bot's response
    try:
        store_chat_message(conversation_id, user_input, displayed_bot_response, chat_topic)
    except Exception as e:
        print(f"An error occurred while storing chat message: {e}")

    return conversation, chat_topic




class MicrophoneStream:
    """Opens a recording stream as a generator yielding the audio chunks."""

    def __init__(self, rate, chunk):
        self._rate = rate
        self._chunk = chunk
        self._buff = queue.Queue()
        self.closed = True

    def __enter__(self):
        self._audio_interface = pyaudio.PyAudio()
        self._audio_stream = self._audio_interface.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=self._rate,
            input=True,
            frames_per_buffer=self._chunk,
            stream_callback=self._fill_buffer,
        )

        self.closed = False
        return self

    def __exit__(self, type, value, traceback):
        self._audio_stream.stop_stream()
        self._audio_stream.close()
        self.closed = True
        self._buff.put(None)
        self._audio_interface.terminate()

    def _fill_buffer(self, in_data, frame_count, time_info, status_flags):
        self._buff.put(in_data)
        return None, pyaudio.paContinue

    def generator(self):
        while not self.closed:
            chunk = self._buff.get()
            if chunk is None:
                return
            data = [chunk]

            while True:
                try:
                    chunk = self._buff.get(block=False)
                    if chunk is None:
                        return
                    data.append(chunk)
                except queue.Empty:
                    break
            yield b"".join(data)


def listen_print_loop(responses, conversation_id):
    num_chars_printed = 0

    for response in responses:
        if not response.results:
            continue

        result = response.results[0]
        if not result.alternatives:
            continue

        transcript = result.alternatives[0].transcript
        overwrite_chars = " " * (num_chars_printed - len(transcript))

        if not result.is_final:
            sys.stdout.write(transcript + overwrite_chars + "\r")
            sys.stdout.flush()

            num_chars_printed = len(transcript)
        else:
            print(transcript + overwrite_chars)

            if re.search(r"\b(exit|quit)\b", transcript, re.I):
                print("Exiting...")
                break

            conversation.append({'role': 'user', 'content': transcript})
            conversation, chat_topic = chat_with_gpt(transcript, conversation, conversation_id)
            response = conversation[-1]['content']
            print("Bot: " + response)

            num_chars_printed = 0


def get_new_conversation_id():
    letters_and_digits = string.ascii_letters + string.digits
    conversation_id = ''.join(random.choices(letters_and_digits, k=10))
    return conversation_id


def synthesize_text(text):
    future = speech_synthesizer.speak_text_async(text)
    return future.get()

def remove_duplicates(chat_data):
    chat_history = []
    previous_message = None
    for message in chat_data:
        if message != previous_message:
            chat_history.append(message)
        previous_message = message
    return chat_history



Base = declarative_base()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/chat', methods=['POST'])
def chat():
    prompt = request.form['prompt']
    conversation_id = session.get('conversation_id')

    # Initialize the conversation for the conversation_id if it hasn't been initialized yet
    if conversation_id not in conversations:
        conversations[conversation_id] = []

    conversation, chat_topic = chat_with_gpt(prompt, conversations[conversation_id], conversation_id)

    # Store the conversation data after getting the bot's response
    user_input = [message['content'] for message in conversation if message['role'] == 'user']
    bot_response = [message['content'] for message in conversation if message['role'] == 'assistant']

    try:
        store_chat_message(conversation_id, user_input, bot_response, chat_topic)
    except Exception as e:
        print(f"An error occurred while storing chat message: {e}")

    return jsonify(conversation=conversation, topic=chat_topic, conversation_id=conversation_id)


@app.route('/new', methods=['GET'])
def new_conversation():
    conversation_id = get_new_conversation_id()

    # Store initial data for a new conversation
    store_chat_message(conversation_id, [], [], "")

    return jsonify({'conversation_id': conversation_id})



@app.route('/slyvision')
def slyvision():
    return render_template('index.html')


@app.route('/img_gen')
def img_gen():
    return render_template('img_gen.html')


@app.route('/get_chat_data', methods=['GET'])
def get_chat_data():
    conversation_id = request.args.get('conversation_id')
    if conversation_id in conversations:
        chat_data = {'conversation': conversations[conversation_id]}
        return jsonify(chat_data)
    else:
        return jsonify(error='Conversation not found'), 404
    

@app.route('/synthesize_speech', methods=['POST'])
def synthesize_speech():
    text = request.form['text']

    try:
        future = executor.submit(synthesize_text, text)
        result = future.result()  # This will block until the future is resolved
    except Exception as e:
        return jsonify({"error": str(e)})

    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        audio_data = base64.b64encode(result.audio_data).decode('utf-8')

    return jsonify({"audioData": audio_data})


@app.route('/get_chat_history', methods=['GET'])
def get_chat_history():
    conversation_id = request.args.get('conversation_id')

    print(f"Conversation ID in /get_chat_history: {conversation_id}")  # Debug line

    if not conversation_id or conversation_id == 'undefined' or conversation_id == 'null':
        return jsonify({'status': 'error', 'message': 'Invalid or missing conversation ID.'}), 400

    try:
        chat_history = fetch_chat_history(conversation_id)

        if chat_history is None:
            return jsonify({'status': 'error', 'message': 'No chat history found for the provided conversation ID.'}), 404

        # Filter out messages with empty content
        filtered_chat_history = [message for message in chat_history if 'content' in message]

        return jsonify({'status': 'success', 'chat_messages': filtered_chat_history})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500



@app.route('/start_new_conversation', methods=['GET'])
def start_new_conversation():
    global memory
    global conversations
    global summary_sentence

    # Clear memory, conversations, and summary_sentence
    memory = []
    conversations = {}
    summary_sentence = None

    # Get a new conversation ID
    conversation_id = get_new_conversation_id()

    # Check if conversation ID already exists
    while conversation_id in conversations:
        conversation_id = get_new_conversation_id()

    # Add the new conversation to the conversations dictionary
    conversations[conversation_id] = []

    # Store the new conversation_id in the session
    session['conversation_id'] = conversation_id

    return jsonify({'status': 'success', 'conversation_id': conversation_id})





def main():
    language_code = "en-US"
    client = speech.SpeechClient.from_service_account_json('key.json')
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=RATE,
        language_code=language_code,
    )
    streaming_config = speech.StreamingRecognitionConfig(
        config=config, interim_results=True
    )

    conversation_id = get_new_conversation_id()

    with MicrophoneStream(RATE, CHUNK) as stream:
        audio_generator = stream.generator()
        requests = (
            speech.StreamingRecognizeRequest(audio_content=content)
            for content in audio_generator
        )

        responses = client.streaming_recognize(streaming_config, requests)

        listen_print_loop(responses, conversation_id)

    subprocess.run(['python', 'img.py'], check=True)


if __name__ == "__main__":
    app.run()
