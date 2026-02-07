#!/usr/bin/env python3
"""Check what actually got indexed in Elasticsearch Serverless"""

import os
import sys
from dotenv import load_dotenv
from elasticsearch import Elasticsearch

load_dotenv('.env.local')

ES_CLOUD_ID = os.getenv('ES_CLOUD_ID')
ES_API_KEY = os.getenv('ES_API_KEY')
INDEX_NAME = 'clinical_trials'

print("=" * 70)
print("CHECKING INDEXED DATA")
print("=" * 70)
print()

try:
    client = Elasticsearch(
        cloud_id=ES_CLOUD_ID,
        api_key=ES_API_KEY
    )

    if not client.ping():
        print("[ERROR] Failed to connect")
        sys.exit(1)

    print("[OK] Connected to Elasticsearch")
    print()

    # Count total documents
    print("Step 1: Counting indexed documents...")
    print("-" * 70)

    count_result = client.count(index=INDEX_NAME)
    total_docs = count_result['count']

    print(f"[OK] Total documents indexed: {total_docs}")
    print()

    # Check for embeddings
    print("Step 2: Checking for embeddings...")
    print("-" * 70)

    sample_with_embedding = client.search(
        index=INDEX_NAME,
        body={
            "query": {"exists": {"field": "description_embedding"}},
            "size": 1
        }
    )

    docs_with_embeddings = sample_with_embedding['hits']['total']['value']
    print(f"[OK] Documents with embeddings: {docs_with_embeddings}")

    if docs_with_embeddings > 0:
        embedding = sample_with_embedding['hits']['hits'][0]['_source'].get('description_embedding', [])
        print(f"  -> Embedding dimensions: {len(embedding)}")
        print(f"  -> Sample values: {embedding[:3]}... (showing first 3)")
    else:
        print("[WARNING] No documents have embeddings!")
    print()

    # Get sample documents
    print("Step 3: Sampling indexed trials...")
    print("-" * 70)

    sample = client.search(
        index=INDEX_NAME,
        body={
            "query": {"match_all": {}},
            "size": 3,
            "_source": {
                "excludes": ["description_embedding"]
            }
        }
    )

    for i, hit in enumerate(sample['hits']['hits'], 1):
        doc = hit['_source']
        print(f"\n[{i}] {doc.get('nct_id', 'N/A')}")
        print(f"  Title: {doc.get('brief_title', 'N/A')[:70]}...")
        print(f"  Phase: {doc.get('phase', 'N/A')}")
        print(f"  Status: {doc.get('overall_status', 'N/A')}")
        print(f"  Quality Score: {doc.get('quality_score', 'N/A')}")

    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total documents: {total_docs} / 1000 (expected)")
    print(f"Documents with embeddings: {docs_with_embeddings}")
    print(f"Missing: {1000 - total_docs} trials")
    print()

    if docs_with_embeddings == 0:
        print("[CRITICAL] No embeddings were generated!")
        print("Reason: Gemini API model 'text-embedding-004' not found")
        print()
        print("Options:")
        print("  1. Fix Gemini model reference and re-index")
        print("  2. Continue with keyword-only search (BM25)")
        print("  3. Use alternative embedding service (OpenAI, Cohere)")
        print()

    if total_docs < 1000:
        print(f"[WARNING] {1000 - total_docs} trials failed to index")
        print("Reason: Data format issues (keywords dict, enrollment 'None')")
        print()

except Exception as e:
    print(f"[ERROR] {str(e)}")
    sys.exit(1)
