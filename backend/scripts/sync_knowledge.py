import boto3
import json
import os
import sys
from botocore.exceptions import NoCredentialsError, PartialCredentialsError

# Load environment variables if dotenv is available
try:
    from dotenv import load_dotenv
    # Assuming script is in backend/scripts/
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
except ImportError:
    pass

S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME', 'jan-sahayak-knowledge-base-2026')
S3_OBJECT_KEY = os.getenv('S3_OBJECT_KEY', 'knowledge.json')
LOCAL_DESTINATION = os.path.join(os.path.dirname(__file__), '..', 'knowledge.json')

def sync_knowledge():
    print(f"Starting knowledge sync from S3 bucket: {S3_BUCKET_NAME}")
    
    # Initialize S3 client
    # AWS credentials should be configured in ~/.aws/credentials or via environment variables
    s3 = boto3.client(
        's3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION', 'ap-south-1')
    )
    
    try:
        print(f"Downloading {S3_OBJECT_KEY} to {LOCAL_DESTINATION}...")
        s3.download_file(S3_BUCKET_NAME, S3_OBJECT_KEY, LOCAL_DESTINATION)
        print("Successfully downloaded knowledge.json from S3!")
        
        # Verify the file is valid JSON
        if os.path.exists(LOCAL_DESTINATION):
            with open(LOCAL_DESTINATION, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    print(f"Knowledge payload verified. Total items inside: {len(data)}")
                elif isinstance(data, dict):
                    print(f"Knowledge payload verified. Object keys: {list(data.keys())[:5]}")
                else:
                    print("Knowledge payload verified.")
            
    except NoCredentialsError:
        print("Error: AWS credentials not found. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.", file=sys.stderr)
    except PartialCredentialsError:
        print("Error: Incomplete AWS credentials.", file=sys.stderr)
    except Exception as e:
        print(f"An error occurred during S3 download: {e}", file=sys.stderr)
        
        # If it fails, we can create a mock knowledge.json for testing if it doesn't exist
        if not os.path.exists(LOCAL_DESTINATION):
            print("Creating a placeholder knowledge.json for local testing...", file=sys.stderr)
            placeholder_data = [
                {
                    "id": "scheme_1",
                    "title": "PM Kisan Samman Nidhi",
                    "category": "Agriculture",
                    "description": "Financial benefit of Rs 6000/- per year to eligible farmer families."
                }
            ]
            with open(LOCAL_DESTINATION, 'w', encoding='utf-8') as f:
                json.dump(placeholder_data, f, indent=4)
            print(f"Created placeholder at {LOCAL_DESTINATION}")

if __name__ == "__main__":
    sync_knowledge()
