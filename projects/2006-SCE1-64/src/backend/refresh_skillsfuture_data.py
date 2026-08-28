# SkillsFuture Course Directory
import os
import re
import io
import requests
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv
load_dotenv()  # loads variables from .env into os.environ

DATASET_ID = "d_b5802b76f409764c16dde4bf2feb19cd"  # SkillsFuture dataset ID
API_URL = f"https://api-open.data.gov.sg/v1/public/api/datasets/{DATASET_ID}/poll-download"
SUPABASE_TABLE = "Course"

#fetch dataset from api
print("Fetching SkillsFuture datasfrom data.gov.sg...")

response = requests.get(API_URL)
response.raise_for_status()
json_data = response.json()

if json_data.get("code") != 0:
    print(f"Error fetching dataset: {json_data.get('errMsg')}")
    exit(1)

file_url = json_data["data"]["url"]
print(f"Latest dataset URL obtained:\n{file_url}")

#Download excel data
print("Downloading dataset...")
file_response = requests.get(file_url)
file_response.raise_for_status()

# load Excel into DataFrame directly from memory
df = pd.read_excel(io.BytesIO(file_response.content))
print(f"Raw dataset loaded: {len(df)} rows, {len(df.columns)} columns.")

# Cleaning Data
print("Cleaning dataset...")

# Only keep relevant columns
expected_fields = [
    "coursereferencenumber",
    "coursetitle",
    "trainingprovideralias",
    "about_this_course",
    "what_you_learn",
    "minimum_entry_requirement"
]
df = df[[col for col in expected_fields if col in df.columns]]

# Cleaning helper
def clean_text(text):
    if not isinstance(text, str):
        return ''
    text = re.sub(r'[‹Ÿ¬]', ' ', text)          # Replace weird symbols
    text = re.sub(r'[^\x20-\x7E]', ' ', text)   # Remove non-printable chars
    text = re.sub(r'\s+', ' ', text)            # Collapse multiple spaces
    return text.strip()

# Apply cleaning to each column
for col in expected_fields:
    if col in df.columns:
        df[col] = df[col].apply(clean_text)

# Add auto-incrementing primary key
df.insert(0, "id", range(1, len(df) + 1))

print(f"Data cleaned successfully. {len(df)} rows ready for upload.")

#Upload to Supabases
upload_to_supabase = True

if upload_to_supabase:
    print("Uploading to Supabase...")

    supabase_url = os.environ["SF_SUPABASE_URL"]
    supabase_key = os.environ["SF_SUPABASE_SERVICE_KEY"]

    supabase: Client = create_client(supabase_url, supabase_key)

    # clear existing rows
    print("Clearing existing data from Supabase table...")
    delete_response = supabase.table(SUPABASE_TABLE).delete().neq("coursereferencenumber", "").execute()
    if delete_response.data is not None:
        print("Existing data cleared.")
    else:
        print("Continuing upload.")

    # Upload new data
    records_to_insert = df.to_dict(orient="records")
    print(f"Inserting {len(records_to_insert)} records...")

    response = supabase.table(SUPABASE_TABLE).insert(records_to_insert).execute()

    if hasattr(response, "status_code") and response.status_code in [200, 201]:
        print("Data uploaded successfully.")
    else:
        print("Error inserting data:", response.data)

print("SkillsFuture Course Directory data refreshed successfully.")
