#!/usr/bin/env python3
"""
Elasticsearch Connection Test Script

This script verifies your Elasticsearch Cloud connection before running the full indexing.

Usage:
    python scripts/test_es_connection.py

What it tests:
1. Loads credentials from .env.local
2. Connects to Elasticsearch Cloud
3. Shows cluster information
4. Checks if clinical_trials index exists
5. Shows sample document if index has data
"""

import os
import sys
from dotenv import load_dotenv

# Try to import Elasticsearch
try:
    from elasticsearch import Elasticsearch
except ImportError:
    print("❌ Elasticsearch package not found!")
    print("\nPlease install it:")
    print("  pip install elasticsearch")
    sys.exit(1)

# Load environment variables
load_dotenv('.env.local')

# Get credentials
ES_CLOUD_ID = os.getenv('ES_CLOUD_ID')
ES_API_KEY = os.getenv('ES_API_KEY')
ES_USERNAME = os.getenv('ES_USERNAME', 'elastic')
ES_PASSWORD = os.getenv('ES_PASSWORD')

INDEX_NAME = 'clinical_trials'

def test_connection():
    """Test Elasticsearch connection"""
    print("=" * 70)
    print("ELASTICSEARCH CONNECTION TEST")
    print("=" * 70)
    print()

    # Step 1: Check credentials
    print("Step 1: Checking credentials...")
    print("-" * 70)

    if not ES_CLOUD_ID:
        print("❌ ES_CLOUD_ID not found in .env.local")
        print("\nPlease add your Elasticsearch Cloud ID:")
        print("  ES_CLOUD_ID=your_cloud_id_here")
        print("\nYou can find this in your Elastic Cloud deployment page")
        return False

    print(f"✓ ES_CLOUD_ID: {ES_CLOUD_ID[:30]}...")

    if ES_API_KEY:
        print(f"✓ ES_API_KEY: {ES_API_KEY[:20]}...")
        auth_method = "API Key (Recommended)"
    elif ES_PASSWORD:
        print(f"✓ ES_USERNAME: {ES_USERNAME}")
        print(f"✓ ES_PASSWORD: {'*' * len(ES_PASSWORD)}")
        auth_method = "Username/Password"
    else:
        print("❌ No authentication found!")
        print("\nPlease add either:")
        print("  ES_API_KEY=your_api_key_here")
        print("or")
        print("  ES_PASSWORD=your_password_here")
        return False

    print(f"✓ Authentication method: {auth_method}")
    print()

    # Step 2: Create client and test connection
    print("Step 2: Connecting to Elasticsearch Cloud...")
    print("-" * 70)

    try:
        # Create client based on available credentials
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

        # Test connection with ping
        if not client.ping():
            print("❌ Failed to ping Elasticsearch cluster")
            return False

        print("✓ Successfully connected to Elasticsearch!")
        print()

        # Step 3: Get cluster info
        print("Step 3: Retrieving cluster information...")
        print("-" * 70)

        info = client.info()
        print(f"✓ Cluster name: {info['cluster_name']}")
        print(f"✓ Elasticsearch version: {info['version']['number']}")
        print(f"✓ Lucene version: {info['version']['lucene_version']}")
        print(f"✓ Cluster UUID: {info['cluster_uuid']}")
        print()

        # Step 4: Check index status
        print("Step 4: Checking clinical_trials index...")
        print("-" * 70)

        if client.indices.exists(index=INDEX_NAME):
            print(f"✓ Index '{INDEX_NAME}' exists!")

            # Get index stats
            stats = client.indices.stats(index=INDEX_NAME)
            doc_count = stats['_all']['primaries']['docs']['count']
            size_bytes = stats['_all']['primaries']['store']['size_in_bytes']
            size_mb = size_bytes / (1024 * 1024)

            print(f"  → Documents: {doc_count}")
            print(f"  → Size: {size_mb:.2f} MB")

            # Get index mapping
            mapping = client.indices.get_mapping(index=INDEX_NAME)
            properties = mapping[INDEX_NAME]['mappings']['properties']

            print(f"  → Fields: {len(properties)}")

            # Check for embeddings field
            if 'description_embedding' in properties:
                embed_dims = properties['description_embedding'].get('dims', 'unknown')
                print(f"  → Embeddings: ✓ ({embed_dims} dimensions)")
            else:
                print(f"  → Embeddings: ✗ (not found)")

            print()

            # Step 5: Show sample document
            if doc_count > 0:
                print("Step 5: Fetching sample document...")
                print("-" * 70)

                result = client.search(
                    index=INDEX_NAME,
                    body={
                        "query": {"match_all": {}},
                        "size": 1,
                        "_source": {
                            "excludes": ["description_embedding"]  # Don't show embedding (too large)
                        }
                    }
                )

                if result['hits']['total']['value'] > 0:
                    doc = result['hits']['hits'][0]['_source']
                    print(f"✓ Sample document (NCT ID: {doc.get('nct_id', 'N/A')})")
                    print(f"  → Title: {doc.get('brief_title', 'N/A')[:80]}...")
                    print(f"  → Phase: {doc.get('phase', 'N/A')}")
                    print(f"  → Status: {doc.get('overall_status', 'N/A')}")
                    print(f"  → Enrollment: {doc.get('enrollment', 'N/A')}")
                    print(f"  → Quality Score: {doc.get('quality_score', 'N/A')}")

                    # Check if embedding exists
                    full_doc = client.get(index=INDEX_NAME, id=doc.get('nct_id'))
                    if 'description_embedding' in full_doc['_source']:
                        embed_len = len(full_doc['_source']['description_embedding'])
                        print(f"  → Embedding: ✓ ({embed_len} dimensions)")
                    else:
                        print(f"  → Embedding: ✗")

                    print()

        else:
            print(f"⚠️  Index '{INDEX_NAME}' does not exist yet")
            print(f"  → Run the indexing script to create it:")
            print(f"     python scripts/index_trials_gemini.py")
            print()

        # Step 6: Test aggregations
        if client.indices.exists(index=INDEX_NAME):
            print("Step 6: Testing aggregations (for filters)...")
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

            print("✓ Phase distribution:")
            for bucket in agg_result['aggregations']['by_phase']['buckets']:
                print(f"  → {bucket['key']}: {bucket['doc_count']} trials")

            print()
            print("✓ Status distribution:")
            for bucket in agg_result['aggregations']['by_status']['buckets']:
                print(f"  → {bucket['key']}: {bucket['doc_count']} trials")

            print()

        # Summary
        print("=" * 70)
        print("CONNECTION TEST SUMMARY")
        print("=" * 70)
        print("✓ Connection: SUCCESS")
        print(f"✓ Authentication: {auth_method}")
        print(f"✓ Cluster: {info['cluster_name']}")
        print(f"✓ Version: {info['version']['number']}")

        if client.indices.exists(index=INDEX_NAME):
            print(f"✓ Index: EXISTS ({doc_count} documents)")
            print()
            print("🎉 Everything is ready!")
            print()
            print("Next steps:")
            print("  1. Your Elasticsearch setup is working perfectly")
            print("  2. You can now run the frontend: npm run dev")
            print("  3. Navigate to the Clinical Search page")
            print("  4. Try searching: 'diabetes trials' or 'cancer immunotherapy'")
        else:
            print(f"⚠️  Index: NOT FOUND")
            print()
            print("Next steps:")
            print("  1. Run the indexing script:")
            print("     python scripts/index_trials_gemini.py")
            print("  2. This will:")
            print("     - Load 1,000 trials from dataset/clinical_trials.json")
            print("     - Generate embeddings using Gemini API")
            print("     - Index into Elasticsearch Cloud")
            print("  3. Then test again: python scripts/test_es_connection.py")

        print()
        return True

    except Exception as e:
        print(f"❌ Connection failed!")
        print(f"\nError: {str(e)}")
        print()
        print("Troubleshooting:")
        print("  1. Check your ES_CLOUD_ID and ES_API_KEY in .env.local")
        print("  2. Verify deployment is running in Elastic Cloud console")
        print("  3. Check that API key hasn't expired")
        print("  4. Ensure network connectivity (VPN, firewall)")
        print()
        print("See docs/ELASTICSEARCH_SETUP.md for detailed setup instructions")
        return False

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)
