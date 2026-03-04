import boto3
import os
import sys

# Get path to root knowledge.json
ROOT_JSON = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "knowledge.json")
S3_BUCKET = os.getenv("S3_BUCKET_NAME", "jan-sahayak-knowledge-base-2026")
S3_KEY = os.getenv("S3_OBJECT_KEY", "knowledge.json")

def upload_to_s3():
    print(f"Uploading {ROOT_JSON} to S3 bucket {S3_BUCKET} as {S3_KEY}...")
    
    if not os.path.exists(ROOT_JSON):
        print(f"Error: Could not find {ROOT_JSON}")
        sys.exit(1)
        
    try:
        s3 = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION', 'ap-south-1')
        )
        s3.upload_file(ROOT_JSON, S3_BUCKET, S3_KEY)
        print("✅ Successfully uploaded to S3!")
    except Exception as e:
        print(f"❌ Upload failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    upload_to_s3()
