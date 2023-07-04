# Importing additional required modules
import datetime
import queue
import re
import sys
import os
from base64 import b64decode
from google.cloud import speech
import pyaudio
import openai
from openai.error import InvalidRequestError
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
openai.api_key = "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"

# Audio recording parameters
RATE = 16000
CHUNK = int(RATE / 10)  # 100ms

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

def listen_print_loop(responses):
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

            num_chars_printed = 0



@app.route('/')
def img_gen():
    return render_template('img_gen.html')

@app.route('/slyvision')
def slyvision():
    return render_template('index.html')

@app.route('/generate_image', methods=['POST'])
def generate_image_route():
    prompt = request.form['prompt']
    num_image = int(request.form.get('num_image', 1))  # get number of images to generate, default is 1
    size = request.form.get('size', '256x256')  # get the size of images to generate, default is '256x256'
    
    response = generate_image(prompt, num_image, size)
    
    if response.get('images'):  # check if there's any image generated
        image_url = response['images'][0]  # get the url of the first image
    else:
        image_url = ''  # or return a default image or error message
    
    return jsonify({'image_url': image_url})


def generate_image(prompt, num_image=1, size='256x256', output_format='url'):
    try:
        images = []
        response = openai.Image.create(
            prompt=prompt,
            n=num_image,
            size=size,
            response_format=output_format
        )
        if output_format == 'url':
            for image in response['data']:
                images.append(image.url)
        elif output_format == 'b64_json':
            for image in response['data']:
                images.append(image.b64_json)
        return {'created': datetime.datetime.fromtimestamp(response['created']), 'images': images}
    except InvalidRequestError as e:
        print(e)

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

    with MicrophoneStream(RATE, CHUNK) as stream:
        audio_generator = stream.generator()
        requests = (
            speech.StreamingRecognizeRequest(audio_content=content)
            for content in audio_generator
        )

        responses = client.streaming_recognize(streaming_config, requests)

        # Now, put the transcription responses to use.
        listen_print_loop(responses)
