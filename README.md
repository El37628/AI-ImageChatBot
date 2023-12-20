# AI-ImageChatBot
Enabling Accessibility and Creativity with AI Chatbot and Image Generation

## Installation Guide

Before starting local testing of the AI Image ChatBot, please follow these installation instructions carefully.

### Prerequisites

- **Python**: Ensure that Python 3.7 or higher is installed on your system. You can download Python from [the official website](https://www.python.org/downloads/).

### Setup Instructions

1. **Install Dependencies**:
   - Open your terminal or command prompt.
   - Navigate to the project's root directory.
   - Run the following command to install the required Python packages:
     ```
     pip install -r requirements.txt
     ```

2. **Configure Environment Variables**:
   - Set up the necessary environment variables for the application to function properly.
   - You will need to apply the following:
     - `SECRET_KEY` in `chat.py`.
     - OpenAI API Key in both `chat.py` and `img.py`.
     - Google OAuth2 client ID and client secret JSON file in `auth.py`.
     - Discord OAuth2 client ID and client secret in `auth.py`.
     - In `db.py`, configure the following Firebase settings:
       - Firebase service account JSON file for `FIREBASE_SERVICE_ACCOUNT_JSON`.
       - Firebase Realtime Database URL for `FIREBASE_REALTIME_DB_URL`.
       - Client secret JSON file of the service account created for Cloud Storage in `SERVICE_ACCOUNT.json`.
     - Discord channel webhook URL under `WEBHOOK_URL` in `feedback.py`.

### Cloud Service Accounts

To use this application, you will need to set up several cloud service accounts:

- **OpenAI Account**: Obtain an API key from [OpenAI](https://openai.com/).
- **Google Cloud Platform Account**: Create OAuth2 credentials (client ID and client secret) and service accounts in the [Google Cloud Console](https://console.cloud.google.com/).
- **Discord Developer Portal**: Create a new application for OAuth2 credentials and webhooks in the [Discord Developer Portal](https://discord.com/developers/applications).
- **Firebase Account**: Set up a Firebase project to obtain the service account JSON and Realtime Database URL from the [Firebase Console](https://console.firebase.google.com/).
