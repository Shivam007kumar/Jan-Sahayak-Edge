"""
Rich Government Schemes Data Generator.
Generates 10 detailed schemes and uploads to S3 bucket.
Usage: python generate_data.py
"""

import json
import os
import sys
import boto3
from dotenv import load_dotenv

# Load .env from backend directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

SCHEMES = {
    "schemes": [
        {
            "id": "pm_kisan",
            "name": "PM-Kisan Samman Nidhi",
            "category": "Agriculture",
            "description": "Direct income support of ₹6,000/year to small and marginal farmer families across India, paid in three equal installments.",
            "benefits": "₹6,000 per year in 3 installments of ₹2,000 each, directly deposited to bank account via DBT.",
            "required_docs": ["aadhar_card", "land_record_7_12", "bank_passbook"],
            "eligibility_rules": "Must be a small/marginal farmer family with cultivable land. Land records (7/12 extract) required. Income below ₹2 lakh/year."
        },
        {
            "id": "ayushman_bharat",
            "name": "Ayushman Bharat - PMJAY",
            "category": "Healthcare",
            "description": "World's largest health insurance scheme providing ₹5 lakh coverage per family per year for secondary and tertiary hospitalization.",
            "benefits": "₹5,00,000 health coverage per family per year. Cashless treatment at empaneled hospitals. Covers pre and post hospitalization expenses.",
            "required_docs": ["aadhar_card", "ration_card"],
            "eligibility_rules": "Families identified in SECC 2011 data or with active ration card. BPL families are auto-eligible."
        },
        {
            "id": "mudra_loan",
            "name": "PM Mudra Yojana",
            "category": "Startup",
            "description": "Provides micro-loans up to ₹10 lakh to non-corporate, non-farm small/micro enterprises for business growth.",
            "benefits": "Shishu: Up to ₹50,000. Kishore: ₹50,001 to ₹5 lakh. Tarun: ₹5 lakh to ₹10 lakh. No collateral needed for Shishu category.",
            "required_docs": ["aadhar_card", "pan_card", "bank_passbook"],
            "eligibility_rules": "Any Indian citizen with a business plan for non-farm income generating activities. Existing businesses looking to expand are eligible."
        },
        {
            "id": "startup_india",
            "name": "Startup India Seed Fund",
            "category": "Startup",
            "description": "Financial assistance up to ₹50 lakh for proof of concept, prototype development, product trials, and market entry.",
            "benefits": "Up to ₹20 lakh as grant for validation. Up to ₹50 lakh as debt/convertible instruments. 3-year tax exemption under Section 80-IAC.",
            "required_docs": ["aadhar_card", "pan_card", "bank_passbook", "10th_marksheet"],
            "eligibility_rules": "Must be DPIIT recognized startup incorporated within last 2 years. Annual turnover should not exceed ₹100 crore."
        },
        {
            "id": "pm_awas",
            "name": "PM Awas Yojana - Gramin",
            "category": "Infrastructure",
            "description": "Financial assistance for construction of pucca houses with basic amenities to homeless or those living in kutcha/dilapidated houses.",
            "benefits": "₹1.20 lakh in plains and ₹1.30 lakh in hilly areas. Additional ₹12,000 for toilet construction under SBM. 90 days of MGNREGA wages.",
            "required_docs": ["aadhar_card", "land_record_7_12", "bank_passbook", "ration_card"],
            "eligibility_rules": "Homeless families or those with kutcha/dilapidated houses. Must be in SECC 2011 deprivation list. Family income below ₹3 lakh/year."
        },
        {
            "id": "sukanya_samriddhi",
            "name": "Sukanya Samriddhi Yojana",
            "category": "Student",
            "description": "Small savings scheme for girl child offering high interest rate (8.2%) and tax benefits to secure the future of daughters.",
            "benefits": "Interest rate of 8.2% p.a. (highest among small savings). Tax deduction under 80C. Partial withdrawal at 18 years for higher education.",
            "required_docs": ["aadhar_card", "pan_card", "bank_passbook"],
            "eligibility_rules": "Girl child below 10 years of age. Maximum 2 accounts per family (one per girl child). Minimum deposit ₹250/year."
        },
        {
            "id": "digital_india",
            "name": "Digital India Internship Scheme",
            "category": "Student",
            "description": "Paid internship program for students in B.Tech/MCA/MBA to work on cutting-edge government digital projects.",
            "benefits": "₹10,000/month stipend for 2-3 months. Certificate from MeitY. Hands-on experience with national digital infrastructure.",
            "required_docs": ["aadhar_card", "10th_marksheet", "12th_marksheet"],
            "eligibility_rules": "Students enrolled in recognized institutions. Must be in pre-final or final year of B.Tech/MCA/MBA."
        },
        {
            "id": "national_scholarship",
            "name": "National Scholarship Portal - SC/ST",
            "category": "Student",
            "description": "Central sector scholarship for SC/ST students covering tuition fees, maintenance allowance, and book grants for higher education.",
            "benefits": "Full tuition fee reimbursement. ₹3,000-10,000/year maintenance allowance based on course. Additional book grant of ₹3,000.",
            "required_docs": ["aadhar_card", "caste_certificate", "10th_marksheet", "12th_marksheet", "bank_passbook"],
            "eligibility_rules": "SC/ST students with family income below ₹2.5 lakh/year. Must have scored above 50% in qualifying exam."
        },
        {
            "id": "atal_pension",
            "name": "Atal Pension Yojana",
            "category": "Agriculture",
            "description": "Government-guaranteed pension scheme for workers in the unorganized sector. Fixed pension of ₹1,000 to ₹5,000/month after age 60.",
            "benefits": "Guaranteed monthly pension of ₹1,000-5,000 after 60. Government co-contributes 50% for eligible subscribers. Spouse gets same pension after subscriber's death.",
            "required_docs": ["aadhar_card", "bank_passbook"],
            "eligibility_rules": "Indian citizens age 18-40. Must have a savings bank account. Not an income tax payer. Not covered under any statutory social security scheme."
        },
        {
            "id": "standup_india",
            "name": "Stand-Up India",
            "category": "Startup",
            "description": "Facilitates bank loans between ₹10 lakh to ₹1 crore for SC/ST and women entrepreneurs to set up greenfield enterprises.",
            "benefits": "Composite loan of ₹10 lakh to ₹1 crore. Covers 75% project cost. Repayment period up to 7 years with 18-month moratorium.",
            "required_docs": ["aadhar_card", "pan_card", "caste_certificate", "bank_passbook"],
            "eligibility_rules": "SC/ST and/or women entrepreneurs above 18 years. Enterprise must be greenfield (new). Borrower should not be in default to any bank."
        }
    ]
}


def main():
    # Save locally first
    output_path = os.path.join(os.path.dirname(__file__), 'knowledge_generated.json')
    with open(output_path, 'w') as f:
        json.dump(SCHEMES, f, indent=2)
    print(f"✅ Generated {len(SCHEMES['schemes'])} schemes → {output_path}")

    # Also update the backend's local knowledge.json
    backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend', 'knowledge.json')
    with open(backend_path, 'w') as f:
        json.dump(SCHEMES, f, indent=2)
    print(f"✅ Updated backend knowledge.json → {backend_path}")

    # Upload to S3
    bucket = "jan-sahayak-knowledge-base-2026"
    key = "knowledge.json"

    try:
        s3 = boto3.client(
            's3',
            region_name=os.getenv("AWS_DEFAULT_REGION", "ap-south-1"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(SCHEMES),
            ContentType='application/json'
        )
        print(f"✅ Uploaded to S3 → s3://{bucket}/{key}")
    except Exception as e:
        print(f"⚠️  S3 upload failed: {e}")
        print("   Local files are ready. Upload manually or check credentials.")


if __name__ == "__main__":
    main()
