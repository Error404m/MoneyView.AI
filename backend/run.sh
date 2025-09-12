#!/bin/bash
source jrb_backend_env/bin/activate
uvicorn app.main:app --reload --port 8000
