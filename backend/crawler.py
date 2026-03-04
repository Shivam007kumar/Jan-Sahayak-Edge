import json
import uuid

def chunk_text(text, max_words=100):
    words = text.split()
    chunks = []
    current_chunk = []
    
    for word in words:
        current_chunk.append(word)
        if len(current_chunk) >= max_words:
            chunks.append(" ".join(current_chunk))
            current_chunk = []
            
    if current_chunk:
        chunks.append(" ".join(current_chunk))
        
    return chunks

def mock_scrape_india_gov_schemes():
    """
    Since actual india.gov.in is a heavily protected Next.js SPA that blocks simple scraping 
    and requires headless browser automation (Selenium/Playwright) which is slow and resource-heavy,
    we validate our Agent's RAG CHUNKING logic here with mock content structured exactly 
    as it would be extracted from the portal.
    
    In a true production setting, this script would be replaced by a Playwright Python script or AWS Lambda.
    """
    print("Starting Standalone Document Ingestion System...\n")
    
    # Mocking what a headless browser WOULD extract from the rendered DOM of the URLs provided
    extracted_raw_dom_articles = [
        {
            "title": "Pradhan Mantri Krishi Sinchayee Yojana (PMKSY)",
            "url": "https://www.india.gov.in/my-government/schemes/pmksy",
            "content": "Pradhan Mantri Krishi Sinchayee Yojana (PMKSY) has been formulated with the vision of extending the coverage of irrigation 'Har Khet ko pani' and improving water use efficiency 'More crop per drop' in a focused manner with end to end solution on source creation, distribution, management, field application and extension activities. Required documents include Aadhar, Land Holding Papers, and Bank Passbook."
        },
        {
            "title": "National Social Assistance Programme (NSAP)",
            "url": "https://www.india.gov.in/my-government/schemes/nsap",
            "content": "The National Social Assistance Programme (NSAP) is a welfare programme being administered by the Ministry of Rural Development. This programme is being implemented in rural areas as well as urban areas. It provides financial assistance to the elderly, widows and persons with disabilities in the form of social pensions. Beneficiaries must be Below Poverty Line (BPL). Required documents: Age proof, BPL Ration Card, Aadhar Card."
        }
    ]

    all_extracted_schemes = []

    for article in extracted_raw_dom_articles:
        scheme_id = str(uuid.uuid4())
        print(f"-> Processing Extracted Scheme: {article['title']}")
        print(f"   URL: {article['url']}")
        
        # Chunk text simulates the RAG preparation step
        chunks = chunk_text(article['content'], max_words=50) 
        
        extracted_scheme = {
            "scheme_id": scheme_id,
            "title": article['title'],
            "url": article['url'],
            "number_of_chunks": len(chunks),
            "chunks": chunks
        }
        all_extracted_schemes.append(extracted_scheme)

    print("\n" + "="*50)
    print("INGESTION & CHUNKING LOGIC COMPLETE")
    print(f"Total schemes successfully processed and chunked: {len(all_extracted_schemes)}")
    print("="*50 + "\n")
    
    # Save to a local json file as proof of concept for the RAG pipeline
    with open("local_crawler_output.json", "w", encoding="utf-8") as f:
        json.dump(all_extracted_schemes, f, indent=4)
        
    print("Saved chunks to local_crawler_output.json ready for DB ingestion.")

if __name__ == "__main__":
    mock_scrape_india_gov_schemes()
