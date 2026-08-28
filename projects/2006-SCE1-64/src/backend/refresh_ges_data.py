#GES
import os
import requests
import pandas as pd
from supabase import create_client, Client

#Step 1: Fetch all data with pagination
dataset_id = "d_3c55210de27fcccda2ed0c63fdd2b352"
url = "https://data.gov.sg/api/action/datastore_search"

limit = 100
offset = 0
all_records = []
print("Fetching data from data.gov.sg...")
while True:
    params = {
        "resource_id": dataset_id,
        "limit": limit,
        "offset": offset
    }
    response = requests.get(url, params=params)
    response.raise_for_status()
    data = response.json()

    records = data['result']['records']
    all_records.extend(records)

    if len(records) < limit:
        break
    offset += limit

print(f"Total records fetched: {len(all_records)}")

#Step 2: Load into DataFrame & clean data
df = pd.DataFrame(all_records)

numeric_cols = [
    'year', 'employment_rate_overall', 'employment_rate_ft_perm',
    'basic_monthly_mean', 'basic_monthly_median',
    'gross_monthly_mean', 'gross_monthly_median',
    'gross_mthly_25_percentile', 'gross_mthly_75_percentile'
]

for col in numeric_cols:
    df[col] = pd.to_numeric(df[col], errors='coerce')
df.fillna(df.mean(numeric_only=True), inplace=True)

print("Data cleaned and numeric columns converted.")

#Step 2.1 Add industry based on degree, if no match check school
degree_to_industry = {
    "Computer Science": "Technology",
    "Computer Engineering": "Technology",
    "Business and Computing": "Technology",
    "Information Systems": "Technology",
    "Information Security": "Technology",
    "Data Science": "Technology",
    "Computational": "Technology",
    "Computing": "Technology",

    "Aerospace Engineering": "Engineering",
    "Mechanical Engineering": "Engineering",
    "Electrical Engineering": "Engineering",
    "Civil Engineering": "Engineering",
    "Chemical Engineering": "Engineering",
    "Environmental Engineering": "Engineering",
    "Engineering": "Engineering",  # catch-all

    "Medicine": "Healthcare",
    "Nursing": "Healthcare",
    "Bioengineering": "Healthcare",
    "Biomedical": "Healthcare",
    "Life Sciences": "Healthcare",
    "Biological Science": "Healthcare",
    "Pharmacy": "Healthcare",
    "Computational Biology": "Healthcare",
    "Dental":"Healthcare",
    "Physiotherapy": "Healthcare",
    "Occupational Therapy": "Healthcare",
    "Radiation Therapy": "Healthcare",
    "Diagnostic Radiography": "Healthcare",

    "Accountancy": "Finance",
    "Accountancy and Business": "Finance",
    "Banking": "Finance",
    "Finance": "Finance",
    "Economics": "Finance",

    "Business": "Business",
    "Marketing": "Business",
    "Management": "Business",
    "Business Administration": "Business",

    "Law": "Legal",
    "LLB": "Legal",

    "Education": "Education",
    "Teaching": "Education",
    "Early Childhood": "Education",

    "Communication": "Media & Communication",
    "Journalism": "Media & Communication",
    "Media": "Media & Communication",

    "Fine Arts": "Arts & Design",
    "Digital Arts": "Arts & Design",
    "Animation": "Arts & Design",
    "Design": "Arts & Design",
    "Industrial Design": "Arts & Design",
    "Visual Communication": "Arts & Design",
    "Art": "Arts & Design",
    "Music": "Arts & Design",

    "Physics": "Science & Research",
    "Chemistry": "Science & Research",
    "Mathematics": "Science & Research",
    "Mathematical Science": "Science & Research",
    "Statistics": "Science & Research",
    "Bachelor of Science": "Science & Research",
    "Bachelor of Applied Science": "Science & Research",
    "Food": "Science & Research",

    "Environmental": "Environment",
    "Maritime": "Maritime",
    "Real Estate": "Real Estate",
    "Architecture": "Architecture",

    "Social Science": "Social Sciences",
    "Sociology": "Social Sciences",
    "Psychology": "Social Sciences",
    "Anthropology": "Social Sciences",
    "Political Science": "Social Sciences",
    "Social Work": "Social Sciences",
    "Public Policy and Global Affairs": "Social Sciences",

    "History": "Humanities",
    "Philosophy": "Humanities",
    "Literature": "Humanities",
    "Languages": "Humanities",
    "Linguistics": "Humanities",
    "Humanities": "Humanities",
    "English": "Humanities",
    "Chinese": "Humanities",
    "Double Major": "Humanities, Art, Social Sciences"
}
school_to_industry = {
    "School of Computing": "Technology",
    "School of Business": "Business",
    "School of Engineering": "Engineering",
    "School of Medicine": "Healthcare",
    "School of Social Sciences": "Social Sciences",
    "School of Humanities": "Humanities",
    "School of Law": "Legal",
    "Accountancy": "Finance",
    "Accountancy and Business": "Finance",
    "Banking": "Finance",
    "Finance": "Finance",
    "Economics": "Finance",

}

def get_industry(row):
    degree = row.get('degree', '') or ''
    school = row.get('school', '') or ''
    #Degree first
    for key, industry in degree_to_industry.items():
        if key.lower() in degree.lower():
            return industry
    #School fallback
    for key, industry in school_to_industry.items():
        if key.lower() in school.lower():
            return industry
    return "Other"

df['industry'] = df.apply(get_industry, axis=1)
print("Industry column added based on degree and school mapping.")


#Step 3: Upload to Supabase
upload_to_supabase = True  #Change to False to skip upload

if upload_to_supabase:
    supabase_url = os.environ['GES_SUPABASE_URL']
    supabase_key = os.environ['GES_SUPABASE_KEY']

    supabase: Client = create_client(supabase_url, supabase_key)
    #Delete all rows from the table
    delete_response = supabase.table('ges_data').delete().neq('degree', '').execute()
    if hasattr(delete_response, "status_code") and delete_response.status_code in [200, 204]:
        print("All existing data cleared.")
    else:
        #print("Error clearing data:", repr(str(delete_response.data).encode('utf-8', errors='replace').decode('utf-8')))
        print("Error clearing data:", str(delete_response.data).encode('ascii', errors='replace').decode())

    #Remove _id before upload
    if '_id' in df.columns:
        records_to_insert = df.drop(columns=['_id']).to_dict(orient='records')
    else:
        records_to_insert = df.to_dict(orient='records')
        
    #Insert new data
    response = supabase.table('ges_data').insert(records_to_insert).execute()
    if hasattr(response, "status_code") and response.status_code in [200, 201]:
        print("Data inserted successfully.")
    else:
        print("Error inserting data:", str(response.data).encode('ascii', errors='replace').decode())
