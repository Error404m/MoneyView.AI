import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

mongo_uri = os.getenv("MONGO_URI")
client = MongoClient(mongo_uri)
db = client["jrb_gmail_pdf_app"]  
tokens_collection = db["tokens"]
user_profiles_collection = db["user_profiles"]


