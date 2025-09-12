# app/gmail_fetcher.py

import datetime
import os
from dotenv import load_dotenv
from pymongo import MongoClient
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from app.db import tokens_collection

# Load environment variables
load_dotenv()

CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
TOKEN_URI = os.getenv("GOOGLE_TOKEN_URI")
SCOPES = os.getenv("GOOGLE_SCOPES")

def get_user_credentials(user_email: str) -> Credentials:
    """
    Retrieve and refresh Gmail OAuth2 credentials for a user.
    """

    user_token = tokens_collection.find_one({"email": user_email})
    if not user_token:
        raise Exception(f"No tokens found for user {user_email}")

    creds = Credentials(
        token=user_token["access_token"],
        refresh_token=user_token["refresh_token"],
        token_uri=TOKEN_URI,
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        scopes=SCOPES
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())

        tokens_collection.update_one(
            {"email": user_email},
            {"$set": {
                "access_token": creds.token,
                "expiry": creds.expiry,
                "updated_at": datetime.datetime.utcnow()
            }}
        )

    return creds
