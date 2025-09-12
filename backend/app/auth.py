import os
from fastapi import APIRouter, Request, Body, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build  
from dotenv import load_dotenv
from pymongo import MongoClient
# from app.db import tokens_collection
from app.gmail_fetcher import get_user_credentials
from app.db import tokens_collection, user_profiles_collection


load_dotenv()

router = APIRouter()

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


CLIENT_CONFIG = {
    "web": {
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
        "redirect_uris": [os.getenv("GOOGLE_REDIRECT_URI")],
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token"
    }
}

@router.get("/auth/login")
def login():
    flow = Flow.from_client_config(
        client_config=CLIENT_CONFIG,
        scopes=SCOPES,
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI")
    )
    auth_url, _ = flow.authorization_url(
        access_type='offline',
        prompt='consent',
        include_granted_scopes='true'
    )
    return RedirectResponse(auth_url)

@router.get("/auth/callback")
def auth_callback(request: Request):
    code = request.query_params.get("code")

    flow = Flow.from_client_config(
        client_config=CLIENT_CONFIG,
        scopes=SCOPES,
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI")
    )
    flow.fetch_token(code=code)
    credentials = flow.credentials

    # Use Gmail API to get user's email
    service = build("gmail", "v1", credentials=credentials)
    profile = service.users().getProfile(userId="me").execute()
    user_email = profile.get("emailAddress")

    # Save to MongoDB
    tokens_collection.update_one(
        {"email": user_email},
        {
            "$set": {
                "access_token": credentials.token,
                "refresh_token": credentials.refresh_token,
                "token_expiry": str(credentials.expiry),
                "scopes": credentials.scopes,
            }
        },
        upsert=True
    )

    user_profiles_collection.update_one(
        {"email": user_email},
        {
            "$setOnInsert": {
                "email": user_email,
                "name": None,
                "dob": None,
                "pan": None,
                "card_last4": None
            }
        },
        upsert=True
    )

    return JSONResponse(content={
        "email": user_email,
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_expiry": str(credentials.expiry),
        "email_access_granted": True
    })

@router.get("/test-token")
def test_token(user_email: str):
    try:
        creds = get_user_credentials(user_email)
        return {"access_token": creds.token}
    except Exception as e:
        return {"error": str(e)}
    

@router.post("/user/update-profile")
def update_user_profile(email: str = Body(...), name: str = None, dob: str = None, pan: str = None, card_last4: str = None):
    update_fields = {}
    if name: update_fields["name"] = name
    if dob: update_fields["dob"] = dob
    if pan: update_fields["pan"] = pan.upper()
    if card_last4: update_fields["card_last4"] = card_last4

    result = user_profiles_collection.update_one(
        {"email": email},
        {"$set": update_fields}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"updated": True, "fields": list(update_fields.keys())}
