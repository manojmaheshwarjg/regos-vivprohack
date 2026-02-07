#!/usr/bin/env python3
"""Simple Elasticsearch Connection Test (Windows Compatible)"""

import os
import sys
from dotenv import load_dotenv

try:
    from elasticsearch import Elasticsearch
except ImportError:
    print("[ERROR] Elasticsearch package not found!")
    print("Install it: pip install elasticsearch")
    sys.exit(1)

load_dotenv('.env.local')

ES_CLOUD_ID = os.getenv('ES_CLOUD_ID')
ES_API_KEY = os.getenv('ES_API_KEY')
ES_USERNAME = os.getenv('ES_USERNAME', 'elastic')
ES_PASSWORD = os.getenv('ES_PASSWORD')
INDEX_NAME = 'clinical_trials'

print("=" * 70)
print("ELASTICSEARCH CONNECTION TEST")
print("=" * 70)
print()

# Check credentials
print("Step 1: Checking credentials...")
print("-" * 70)

if not ES_CLOUD_ID:
    print("[ERROR] ES_CLOUD_ID not found in .env.local")
    sys.exit(1)

print(f"[OK] ES_CLOUD_ID: {ES_CLOUD_ID[:30]}...")

if ES_API_KEY:
    print(f"[OK] ES_API_KEY: {ES_API_KEY[:20]}...")
    auth_method = "API Key"
elif ES_PASSWORD:
    print(f"[OK] ES_USERNAME: {ES_USERNAME}")
    print(f"[OK] ES_PASSWORD: {'*' * len(ES_PASSWORD)}")
    auth_method = "Username/Password"
else:
    print("[ERROR] No authentication found!")
    sys.exit(1)

print(f"[OK] Authentication method: {auth_method}")
print()

# Connect
print("Step 2: Connecting to Elasticsearch Cloud...")
print("-" * 70)

try:
    if ES_API_KEY:
        client = Elasticsearch(
            cloud_id=ES_CLOUD_ID,
            api_key=ES_API_KEY
        )
    else:
        client = Elasticsearch(
            cloud_id=ES_CLOUD_ID,
            basic_auth=(ES_USERNAME, ES_PASSWORD)
        )

    if not client.ping():
        print("[ERROR] Failed to ping Elasticsearch cluster")
        sys.exit(1)

    print("[OK] Successfully connected to Elasticsearch!")
    print()

    # Get cluster info
    print("Step 3: Retrieving cluster information...")
    print("-" * 70)

    info = client.info()
    print(f"[OK] Cluster name: {info['cluster_name']}")
    print(f"[OK] Elasticsearch version: {info['version']['number']}")
    print(f"[OK] Lucene version: {info['version']['lucene_version']}")
    print()

    # Check index
    print("Step 4: Checking clinical_trials index...")
    print("-" * 70)

    if client.indices.exists(index=INDEX_NAME):
        print(f"[OK] Index '{INDEX_NAME}' exists!")

        stats = client.indices.stats(index=INDEX_NAME)
        doc_count = stats['_all']['primaries']['docs']['count']
        size_bytes = stats['_all']['primaries']['store']['size_in_bytes']
        size_mb = size_bytes / (1024 * 1024)

        print(f"  -> Documents: {doc_count}")
        print(f"  -> Size: {size_mb:.2f} MB")

        # Check for embeddings
        mapping = client.indices.get_mapping(index=INDEX_NAME)
        properties = mapping[INDEX_NAME]['mappings']['properties']

        if 'description_embedding' in properties:
            embed_dims = properties['description_embedding'].get('dims', 'unknown')
            print(f"  -> Embeddings: YES ({embed_dims} dimensions)")
        else:
            print(f"  -> Embeddings: NO")

        print()

        # Sample document
        if doc_count > 0:
            print("Step 5: Fetching sample document...")
            print("-" * 70)

            result = client.search(
                index=INDEX_NAME,
                body={
                    "query": {"match_all": {}},
                    "size": 1,
                    "_source": {
                        "excludes": ["description_embedding"]
                    }
                }
            )

            if result['hits']['total']['value'] > 0:
                doc = result['hits']['hits'][0]['_source']
                print(f"[OK] Sample document (NCT ID: {doc.get('nct_id', 'N/A')})")
                print(f"  -> Title: {doc.get('brief_title', 'N/A')[:80]}...")
                print(f"  -> Phase: {doc.get('phase', 'N/A')}")
                print(f"  -> Status: {doc.get('overall_status', 'N/A')}")
                print(f"  -> Enrollment: {doc.get('enrollment', 'N/A')}")
                print(f"  -> Quality Score: {doc.get('quality_score', 'N/A')}")
                print()

        # Test aggregations
        print("Step 6: Testing aggregations...")
        print("-" * 70)

        agg_result = client.search(
            index=INDEX_NAME,
            body={
                "size": 0,
                "aggs": {
                    "by_phase": {"terms": {"field": "phase", "size": 5}},
                    "by_status": {"terms": {"field": "overall_status", "size": 5}}
                }
            }
        )

        print("[OK] Phase distribution:")
        for bucket in agg_result['aggregations']['by_phase']['buckets']:
            print(f"  -> {bucket['key']}: {bucket['doc_count']} trials")

        print()
        print("[OK] Status distribution:")
        for bucket in agg_result['aggregations']['by_status']['buckets']:
            print(f"  -> {bucket['key']}: {bucket['doc_count']} trials")

        print()
        print("=" * 70)
        print("SUCCESS! Everything is ready!")
        print("=" * 70)
        print()
        print("Next steps:")
        print("  1. Run the frontend: npm run dev")
        print("  2. Navigate to Clinical Search page")
        print("  3. Try searching: 'diabetes trials' or 'cancer immunotherapy'")
        print()

    else:
        print(f"[WARNING] Index '{INDEX_NAME}' does not exist yet")
        print()
        print("Next steps:")
        print("  1. Run the indexing script:")
        print("     python scripts/index_trials_gemini.py")
        print("  2. This will index 1,000 trials with embeddings")
        print("  3. Then test again: python scripts/test_es_simple.py")
        print()

except Exception as e:
    print(f"[ERROR] Connection failed!")
    print(f"\nError: {str(e)}")
    print()
    print("Troubleshooting:")
    print("  1. Check ES_CLOUD_ID and ES_API_KEY in .env.local")
    print("  2. Verify deployment is running in Elastic Cloud")
    print("  3. Check network connectivity")
    sys.exit(1)
