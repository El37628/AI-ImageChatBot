from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for, session, abort, json, current_app, make_response
from flask_login import login_user, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from db import store_user, User, get_user_by_username, get_user_by_discord_id, load_username
from google.oauth2 import id_token
from google_auth_oauthlib.flow import Flow
from pip._vendor import cachecontrol
import google.auth.transport.requests
import os
import requests
from requests_oauthlib import OAuth2Session
from datetime import timedelta

SECRET_KEY = "el_yw_520021"

auth = Blueprint('auth', __name__)

#Google OAuth2 Login
GOOGLE_CLIENT_ID = "CLOUD_CREDENTIALS_CLIENT_ID"
client_secrets_file = "CLIENT_SECRET_JSON"
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

#Discord OAuth2 Login
OAUTH2_CLIENT_ID = 'DISCORD_OAUTH2_CLIENT_ID'
OAUTH2_CLIENT_SECRET = 'DISCORD_OAUTH2_CLIENT_SECRET'
OAUTH2_REDIRECT_URI = 'http://127.0.0.1:5000/discord-callback'

API_BASE_URL = 'https://discord.com/api'
AUTHORIZATION_BASE_URL = API_BASE_URL + '/oauth2/authorize'
TOKEN_URL = API_BASE_URL + '/oauth2/token'

flow = Flow.from_client_secrets_file(
    client_secrets_file,
    scopes=["https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email", "openid"],
    redirect_uri='http://127.0.0.1:5000/callback'
)

@auth.route('/get_username')
def get_username():
    # Check if a user is logged in
    if current_user.is_authenticated:
        # Get user_id from Flask-Login's current_user
        user_id = current_user.get_id()

        # Fetch user data
        user = User.get(user_id)
        if user:
            return jsonify({'username': user.username, 'user_id': user_id})
        else:
            return jsonify({'error': 'No user found with provided user_id.'}), 404
    else:
        return jsonify({'error': 'No user_id found in session.'}), 401


@auth.route('/login_page')
def login_page():
    return render_template('login.html')

@auth.route('/register_page')
def register_page():
    # Check if the success flag is present in the URL parameters
    success = request.args.get('success')
    return render_template('register.html', success=success)

@auth.route('/register', methods=['POST'])
def register():
    # Get form data
    username = request.form.get('username')
    email = request.form.get('email')
    password = request.form.get('password')

    # Check if the username or email already exists
    if User.get_by_username(username):
        flash('Username already exists. Please choose a different username.')
        return jsonify({"success": False, "error": "username_exists"})
    elif User.get_by_email(email):
        flash('Email already registered. Please use a different email.')
        return jsonify({"success": False, "error": "email_exists"})

    # Hash the password before storing
    hashed_password = generate_password_hash(password)

    # Create user in Firebase
    User.create(username=username, email=email, password=hashed_password)

    flash('Successfully registered')
    return jsonify({"success": True})

def verify_user(username, password):
    user_data = get_user_by_username(username)
    if user_data:
        # Temporarily hardcode a known password and hash
        password = "mypassword"
        hashed_password = generate_password_hash(password)
        
        print("Hashed password:", hashed_password)

        password_check = check_password_hash(hashed_password, password)
        print("Password check result:", password_check)
        
        return password_check
    return False

def verify_token(token):
    # use User.verify_auth_token to check if the token is valid
    user_data = User.verify_auth_token(token)

    # if the token is valid, user_data should not be None
    if user_data:
        return True

    # if the token is not valid, user_data would be None
    return False


@auth.route('/')
def initial_endpoint():
    return redirect(url_for('home'))


@auth.route('/login', methods=['POST'])
def login():
    # Get form data
    username = request.form.get('username')
    password = request.form.get('password')
    keep_signed_in = request.form.get('keepMeSignedIn') == 'true'

    # Verify user credentials (you can keep the existing verify_user function)
    if verify_user(username, password):
        # Authentication successful
        user_data = get_user_by_username(username)

        # Create a User object from the retrieved user data
        user = User(user_data['id'], user_data['username'], user_data['email'])

        # Log the user in using Flask-Login and set session duration
        login_user(user, remember=keep_signed_in)

        # Set the session duration based on the "Keep Me Signed In" checkbox
        if keep_signed_in:
            session.permanent = True
            current_app.permanent_session_lifetime = timedelta(days=30)  # Set to 30 days
            session['userToken'] = user.generate_auth_token(expiration=2592000)  # generate a token that lasts 1 month
        else:
            session.permanent = False  # Set to browser session duration (default)
            session['userToken'] = user.generate_auth_token()  # generate a token with default duration

        # Return the success response to the frontend (JavaScript) without the token
        return jsonify({
            "success": True, 
            "redirect_url": url_for('home'),
            "user_id": user.id  # Include user_id in the response
        })

    else:
        # Authentication failed
        flash('Invalid username or password')

        # Return the failure response to the frontend (JavaScript)
        return jsonify({"success": False})

    
### Google callback ###
@auth.route('/google-login')
def google_login():
    authorization_url, state = flow.authorization_url(include_granted_scopes='true')
    session["state"] = state
    return redirect(authorization_url)

@auth.route('/callback')
def callback():
    flow.fetch_token(authorization_response=request.url)

    if "state" not in request.args:
        abort(400)  # Bad Request: state parameter missing

    if not session["state"] == request.args["state"]:
        abort(500)  # State does not match!

    credentials = flow.credentials
    session['google_access_token'] = credentials.token
    request_session = requests.session()
    cached_session = cachecontrol.CacheControl(request_session)
    token_request = google.auth.transport.requests.Request(session=cached_session)

    id_info = id_token.verify_oauth2_token(
        id_token=credentials._id_token,
        request=token_request,
        audience=GOOGLE_CLIENT_ID
    )

    session["google_id"] = id_info.get("sub")
    session["name"] = id_info.get("name")
    session["email"] = id_info.get("email")

    user = User.create_with_google(id_info.get("sub"), id_info.get("email"))
    login_user(user, remember=True)

    session.permanent = True
    current_app.permanent_session_lifetime = timedelta(days=30)  # Set to 30 days
    session['userToken'] = user.generate_auth_token(expiration=2592000)  # generate a token that lasts 1 month

    return redirect('/')

### Discord callback ###
@auth.route('/discord-login')
def discord_login():
    discord = OAuth2Session(OAUTH2_CLIENT_ID, redirect_uri=OAUTH2_REDIRECT_URI, scope='identify email')
    authorization_url, state = discord.authorization_url(AUTHORIZATION_BASE_URL)
    session['oauth2_state'] = state
    return redirect(authorization_url)

@auth.route('/discord-callback')
def discord_callback():
    discord = OAuth2Session(OAUTH2_CLIENT_ID, state=session['oauth2_state'], redirect_uri=OAUTH2_REDIRECT_URI, scope='identify email')
    token = discord.fetch_token(
        TOKEN_URL,
        client_secret=OAUTH2_CLIENT_SECRET,
        authorization_response=request.url,
    )
    session['discord_token'] = token
    discord_user = discord.get(API_BASE_URL + '/users/@me').json()
    
    user_data = get_user_by_discord_id(discord_user.get('id'))
    if user_data is None:
        # Store user data in your database
        user_data = {
            'discord_id': discord_user.get('id'),
            'username': discord_user.get('username') if discord_user.get('username') else '',
            'email': discord_user.get('email') if discord_user.get('email') else ''
        }
        store_user(user_data)
        user_data = get_user_by_discord_id(discord_user.get('id')) # get the user we just created

    

    session.permanent = True
    current_app.permanent_session_lifetime = timedelta(days=30)  # Set to 30 days
    session['userToken'] = user_data.generate_auth_token(expiration=2592000)

    user = User(id=user_data.id, username=user_data.username, email=user_data.email, discord_id=user_data.discord_id)
    login_user(user, remember=True)
    
    return redirect(url_for('slyvision'))

@auth.route('/logout')
def logout():
    # If the user is logged in using Google OAuth2, revoke the Google access token
    if 'google_access_token' in session:
        requests.post('https://oauth2.googleapis.com/revoke',
                      params={'token': session['google_access_token']},
                      headers={'content-type': 'application/x-www-form-urlencoded'})

    # Log the user out using Flask-Login
    logout_user()

    # Clear the session
    session.clear()

    # Create a response object indicating success
    response = jsonify(success=True)

    # Add headers to clear the session cookie immediately
    response.headers.add('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT;')
    response.headers.add('Set-Cookie', 'remember_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict;')
    return response