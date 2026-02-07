#!/usr/bin/env python3
"""
Clinical Trials Elasticsearch Indexing Script with Gemini Embeddings

This script:
1. Loads clinical trials from dataset/clinical_trials.json
2. Generates semantic embeddings using Google Gemini API (768 dimensions)
3. Calculates quality scores
4. Bulk indexes into Elasticsearch Cloud with dense_vector field
5. Validates successful indexing

Usage:
    python scripts/index_trials_gemini.py

Requirements:
    pip install elasticsearch google-generativeai python-dotenv tqdm
"""

import json
import os
import sys
import time
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path

# Try to import required packages
try:
    from elasticsearch import Elasticsearch, helpers
    import google.generativeai as genai
    from tqdm import tqdm
    from dotenv import load_dotenv
except ImportError as e:
    print(f"❌ Missing required package: {e}")
    print("\nPlease install dependencies:")
    print("  pip install elasticsearch google-generativeai python-dotenv tqdm")
    sys.exit(1)

# Load environment variables
load_dotenv('.env.local')

# Configuration
DATASET_PATH = 'dataset/clinical_trials.json'
INDEX_NAME = 'clinical_trials'
BATCH_SIZE = 50  # Smaller batch for API rate limits
EMBEDDING_BATCH_SIZE = 10  # Gemini API batch size
EMBEDDING_DIMENSION = 768  # Gemini text-embedding-004 uses 768 dims

# Elasticsearch configuration
ES_CLOUD_ID = os.getenv('ES_CLOUD_ID')
ES_API_KEY = os.getenv('ES_API_KEY')
ES_USERNAME = os.getenv('ES_USERNAME', 'elastic')
ES_PASSWORD = os.getenv('ES_PASSWORD')

# Gemini API configuration
GEMINI_API_KEY = os.getenv('VITE_GEMINI_API_KEY') or os.getenv('GEMINI_API_KEY')


def initialize_gemini():
    """Initialize Gemini API client."""
    if not GEMINI_API_KEY:
        print("⚠️  Warning: GEMINI_API_KEY not found in .env.local")
        print("Embeddings will not be generated. Indexing will continue without semantic search.")
        return False

    try:
        genai.configure(api_key=GEMINI_API_KEY)
        print("✓ Gemini API initialized")
        return True
    except Exception as e:
        print(f"⚠️  Warning: Failed to initialize Gemini API: {e}")
        print("Continuing without embeddings...")
        return False


def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings for a batch of texts using Gemini API.
    Returns list of 768-dimensional vectors.
    """
    try:
        # Use text-embedding-004 model (latest, 768 dimensions)
        embeddings = []

        for text in texts:
            # Truncate to avoid token limits (~2048 tokens)
            truncated_text = text[:8000] if len(text) > 8000 else text

            result = genai.embed_content(
                model="models/text-embedding-004",
                content=truncated_text,
                task_type="retrieval_document"
            )

            embeddings.append(result['embedding'])

            # Rate limiting: Gemini free tier has 1500 requests/minute
            time.sleep(0.05)  # ~20 requests/second = 1200/minute

        return embeddings

    except Exception as e:
        print(f"⚠️  Warning: Failed to generate embeddings: {e}")
        return [[0.0] * EMBEDDING_DIMENSION] * len(texts)  # Return zero vectors as fallback


def calculate_quality_score(trial: Dict[str, Any]) -> float:
    """
    Calculate quality score for a trial (0-100).

    Factors:
    - Completeness: Has all key fields filled
    - Sponsor: Industry vs academic
    - Design: Randomization, blinding
    - Size: Enrollment count
    - Recency: How recent the trial is
    """
    score = 0.0

    # Completeness (40 points)
    required_fields = ['brief_title', 'official_title', 'brief_summaries_description',
                       'phase', 'overall_status', 'enrollment', 'source']
    filled = sum(1 for field in required_fields if trial.get(field))
    score += (filled / len(required_fields)) * 40

    # Has detailed description (10 points)
    if trial.get('detailed_description'):
        score += 10

    # Sponsor quality (15 points)
    source = str(trial.get('source', '')).lower()
    industry_sponsors = ['pfizer', 'novartis', 'roche', 'merck', 'astrazeneca',
                         'bristol', 'johnson', 'abbvie', 'gilead', 'amgen',
                         'sanofi', 'gsk', 'bayer', 'eli lilly', 'takeda']
    if any(sponsor in source for sponsor in industry_sponsors):
        score += 15
    elif trial.get('sponsors') and len(trial['sponsors']) > 0:
        if trial['sponsors'][0].get('agency_class') == 'INDUSTRY':
            score += 12
        else:
            score += 8

    # Study design quality (15 points)
    if trial.get('allocation') == 'RANDOMIZED':
        score += 5
    if trial.get('masking') in ['DOUBLE', 'TRIPLE', 'QUADRUPLE']:
        score += 5
    if trial.get('has_dmc'):  # Data monitoring committee
        score += 5

    # Enrollment size (10 points)
    try:
        enrollment = int(trial.get('enrollment', 0))
        if enrollment >= 1000:
            score += 10
        elif enrollment >= 500:
            score += 8
        elif enrollment >= 100:
            score += 5
        elif enrollment >= 50:
            score += 3
    except (ValueError, TypeError):
        pass

    # Recency (10 points)
    start_date = trial.get('start_date')
    if start_date:
        try:
            start_year = int(start_date[:4]) if isinstance(start_date, str) else datetime.now().year
            current_year = datetime.now().year
            if start_year >= current_year:
                score += 10
            elif start_year >= current_year - 1:
                score += 8
            elif start_year >= current_year - 2:
                score += 5
            elif start_year >= current_year - 5:
                score += 3
        except (ValueError, TypeError):
            pass

    return min(100.0, score)


def generate_searchable_text(trial: Dict[str, Any]) -> str:
    """
    Combine trial fields into a single text for embedding generation.
    Prioritizes most important fields for semantic understanding.
    """
    parts = []

    # Title (most important)
    if trial.get('brief_title'):
        parts.append(f"Title: {trial['brief_title']}")

    # Official title
    if trial.get('official_title') and trial.get('official_title') != trial.get('brief_title'):
        parts.append(f"Full title: {trial['official_title']}")

    # Summary description (critical for semantic understanding)
    if trial.get('brief_summaries_description'):
        parts.append(f"Summary: {trial['brief_summaries_description']}")

    # Detailed description (if available and not too long)
    if trial.get('detailed_description'):
        desc = trial['detailed_description']
        if len(desc) < 2000:  # Include if reasonable length
            parts.append(f"Description: {desc}")

    # Conditions
    if trial.get('conditions'):
        conditions_list = []
        for c in trial['conditions']:
            if isinstance(c, dict):
                conditions_list.append(c.get('condition_name', ''))
            else:
                conditions_list.append(str(c))
        conditions_text = ', '.join([c for c in conditions_list if c])
        if conditions_text:
            parts.append(f"Conditions: {conditions_text}")

    # Interventions
    if trial.get('interventions'):
        interventions_list = []
        for i in trial['interventions']:
            if isinstance(i, dict):
                interventions_list.append(i.get('intervention_name', ''))
            else:
                interventions_list.append(str(i))
        interventions_text = ', '.join([i for i in interventions_list if i])
        if interventions_text:
            parts.append(f"Interventions: {interventions_text}")

    # Keywords
    if trial.get('keywords'):
        if isinstance(trial['keywords'], list):
            keywords_text = ', '.join(trial['keywords'])
        else:
            keywords_text = str(trial['keywords'])
        if keywords_text:
            parts.append(f"Keywords: {keywords_text}")

    # Phase and status for context
    if trial.get('phase'):
        parts.append(f"Phase: {trial['phase']}")
    if trial.get('overall_status'):
        parts.append(f"Status: {trial['overall_status']}")

    return ' '.join(parts)


def transform_trial_for_indexing(trial: Dict[str, Any], embedding: List[float] = None) -> Dict[str, Any]:
    """
    Transform raw trial data into Elasticsearch document format.
    """
    doc = {
        'nct_id': trial.get('nct_id'),
        'brief_title': trial.get('brief_title'),
        'official_title': trial.get('official_title'),
        'brief_summaries_description': trial.get('brief_summaries_description'),
        'detailed_description': trial.get('detailed_description'),
        'phase': trial.get('phase'),
        'overall_status': trial.get('overall_status'),
        'enrollment': trial.get('enrollment'),
        'source': trial.get('source'),
        'study_type': trial.get('study_type'),
        'gender': trial.get('gender'),
        'minimum_age': trial.get('minimum_age'),
        'maximum_age': trial.get('maximum_age'),
        'start_date': trial.get('start_date'),
        'completion_date': trial.get('completion_date'),
        'primary_completion_date': trial.get('primary_completion_date'),
        'conditions': trial.get('conditions', []),
        'interventions': trial.get('interventions', []),
        'facilities': trial.get('facilities', []),
        'sponsors': trial.get('sponsors', []),
        'keywords': trial.get('keywords', []),
        'design_outcomes': trial.get('design_outcomes', []),
        'quality_score': calculate_quality_score(trial),
        'indexed_at': datetime.utcnow().isoformat(),
    }

    # Add embedding if available
    if embedding is not None and len(embedding) == EMBEDDING_DIMENSION:
        doc['description_embedding'] = embedding

    return doc


def create_index_if_not_exists(es: Elasticsearch):
    """
    Create index with proper mappings for dense_vector if it doesn't exist.
    """
    if es.indices.exists(index=INDEX_NAME):
        print(f"✓ Index '{INDEX_NAME}' already exists")

        # Ask user if they want to delete and recreate
        response = input("Delete and recreate index? (y/N): ").strip().lower()
        if response == 'y':
            print(f"Deleting index '{INDEX_NAME}'...")
            es.indices.delete(index=INDEX_NAME)
            print("✓ Index deleted")
        else:
            print("Using existing index")
            return

    print(f"Creating index '{INDEX_NAME}' with dense_vector mapping...")

    index_body = {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 1,
            "analysis": {
                "analyzer": {
                    "medical_analyzer": {
                        "type": "custom",
                        "tokenizer": "standard",
                        "filter": ["lowercase", "stemmer"]
                    }
                }
            }
        },
        "mappings": {
            "properties": {
                "nct_id": {"type": "keyword"},
                "brief_title": {
                    "type": "text",
                    "analyzer": "medical_analyzer",
                    "fields": {"keyword": {"type": "keyword"}}
                },
                "official_title": {
                    "type": "text",
                    "analyzer": "medical_analyzer"
                },
                "brief_summaries_description": {
                    "type": "text",
                    "analyzer": "medical_analyzer"
                },
                "detailed_description": {
                    "type": "text",
                    "analyzer": "medical_analyzer"
                },
                "phase": {"type": "keyword"},
                "overall_status": {"type": "keyword"},
                "enrollment": {"type": "integer"},
                "source": {"type": "keyword"},
                "start_date": {"type": "date"},
                "completion_date": {"type": "date"},
                "primary_completion_date": {"type": "date"},
                "study_type": {"type": "keyword"},
                "gender": {"type": "keyword"},
                "minimum_age": {"type": "text"},
                "maximum_age": {"type": "text"},
                "conditions": {"type": "nested"},
                "interventions": {"type": "nested"},
                "facilities": {"type": "nested"},
                "sponsors": {"type": "nested"},
                "keywords": {"type": "text", "analyzer": "medical_analyzer"},
                "design_outcomes": {"type": "nested"},
                "description_embedding": {
                    "type": "dense_vector",
                    "dims": EMBEDDING_DIMENSION,
                    "index": True,
                    "similarity": "cosine"
                },
                "quality_score": {"type": "float"},
                "indexed_at": {"type": "date"}
            }
        }
    }

    es.indices.create(index=INDEX_NAME, body=index_body)
    print(f"✓ Index '{INDEX_NAME}' created with dense_vector field (768 dims, cosine similarity)")


def bulk_index_trials(es: Elasticsearch, trials: List[Dict], use_embeddings: bool = True):
    """
    Bulk index trials into Elasticsearch with Gemini embeddings.
    """
    print(f"\nIndexing {len(trials)} trials...")

    # Generate embeddings if enabled
    embeddings = None
    if use_embeddings:
        print("Generating embeddings using Gemini API (this may take several minutes)...")
        print(f"Rate limit: ~20 requests/second to stay under API limits")

        texts = [generate_searchable_text(trial) for trial in trials]
        embeddings = []

        # Process in batches with progress bar
        with tqdm(total=len(texts), desc="Generating embeddings") as pbar:
            for i in range(0, len(texts), EMBEDDING_BATCH_SIZE):
                batch = texts[i:i + EMBEDDING_BATCH_SIZE]
                batch_embeddings = generate_embeddings_batch(batch)
                embeddings.extend(batch_embeddings)
                pbar.update(len(batch))

        print(f"✓ Generated {len(embeddings)} embeddings (768 dimensions each)")
    else:
        print("⚠️  Skipping embedding generation (Gemini API not available)")

    # Prepare documents for bulk indexing
    actions = []
    for i, trial in enumerate(trials):
        embedding = embeddings[i] if embeddings else None
        doc = transform_trial_for_indexing(trial, embedding)

        action = {
            "_index": INDEX_NAME,
            "_id": trial.get('nct_id'),
            "_source": doc
        }
        actions.append(action)

    # Bulk index with progress bar
    print("\nIndexing documents to Elasticsearch...")
    success = 0
    failed = 0

    with tqdm(total=len(actions), desc="Indexing progress") as pbar:
        for ok, response in helpers.streaming_bulk(
            es,
            actions,
            chunk_size=BATCH_SIZE,
            raise_on_error=False,
            raise_on_exception=False
        ):
            if ok:
                success += 1
            else:
                failed += 1
                print(f"\n⚠️  Failed to index document: {response}")
            pbar.update(1)

    print(f"\n✓ Successfully indexed {success} trials")
    if failed > 0:
        print(f"⚠️  Failed to index {failed} trials")

    return success, failed


def validate_indexing(es: Elasticsearch):
    """
    Validate that trials were indexed successfully.
    """
    print("\nValidating indexing...")

    # Refresh index to make documents searchable
    es.indices.refresh(index=INDEX_NAME)

    # Check document count
    count = es.count(index=INDEX_NAME)['count']
    print(f"✓ Total documents in index: {count}")

    # Check index health
    health = es.cluster.health(index=INDEX_NAME)
    print(f"✓ Index health: {health['status'].upper()}")

    # Test a simple search
    search_result = es.search(
        index=INDEX_NAME,
        body={
            "query": {"match_all": {}},
            "size": 1
        }
    )

    if search_result['hits']['total']['value'] > 0:
        print("✓ Search test successful")
        sample_doc = search_result['hits']['hits'][0]
        print(f"✓ Sample document: {sample_doc['_source']['nct_id']} - {sample_doc['_source']['brief_title'][:60]}...")

        # Check if embeddings are present
        if 'description_embedding' in sample_doc['_source']:
            print(f"✓ Embeddings present ({len(sample_doc['_source']['description_embedding'])} dimensions)")
        else:
            print("⚠️  No embeddings found in documents")

    # Test aggregations
    agg_result = es.search(
        index=INDEX_NAME,
        body={
            "size": 0,
            "aggs": {
                "by_phase": {"terms": {"field": "phase", "size": 10}},
                "by_status": {"terms": {"field": "overall_status", "size": 10}}
            }
        }
    )

    print("\n✓ Phase distribution:")
    for bucket in agg_result['aggregations']['by_phase']['buckets']:
        print(f"  - {bucket['key']}: {bucket['doc_count']} trials")

    print("\n✓ Status distribution:")
    for bucket in agg_result['aggregations']['by_status']['buckets']:
        print(f"  - {bucket['key']}: {bucket['doc_count']} trials")


def main():
    """Main execution function."""
    print("=" * 70)
    print("Clinical Trials Elasticsearch Indexing with Gemini Embeddings")
    print("=" * 70)

    # Check if dataset exists
    if not os.path.exists(DATASET_PATH):
        print(f"❌ Error: Dataset not found at {DATASET_PATH}")
        sys.exit(1)

    # Load trials
    print(f"\nLoading clinical trials from {DATASET_PATH}...")
    with open(DATASET_PATH, 'r', encoding='utf-8') as f:
        trials = json.load(f)
    print(f"✓ Loaded {len(trials)} trials")

    # Check Elasticsearch credentials
    if not ES_CLOUD_ID and not ES_API_KEY:
        print("\n❌ Error: Elasticsearch credentials not found!")
        print("Please set ES_CLOUD_ID and ES_API_KEY in .env.local")
        print("See docs/ELASTICSEARCH_SETUP.md for instructions")
        sys.exit(1)

    # Connect to Elasticsearch
    print("\nConnecting to Elasticsearch Cloud...")
    try:
        if ES_CLOUD_ID and ES_API_KEY:
            es = Elasticsearch(
                cloud_id=ES_CLOUD_ID,
                api_key=ES_API_KEY
            )
        elif ES_PASSWORD:
            es = Elasticsearch(
                cloud_id=ES_CLOUD_ID,
                basic_auth=(ES_USERNAME, ES_PASSWORD)
            )
        else:
            print("❌ Error: No valid authentication method found")
            sys.exit(1)

        # Test connection
        info = es.info()
        print(f"✓ Connected to Elasticsearch {info['version']['number']}")
        print(f"✓ Cluster: {info['cluster_name']}")
    except Exception as e:
        print(f"❌ Error connecting to Elasticsearch: {e}")
        print("\nTroubleshooting:")
        print("1. Check that ES_CLOUD_ID and ES_API_KEY are correct in .env.local")
        print("2. Verify your deployment is running in Elastic Cloud console")
        print("3. Check network connectivity")
        sys.exit(1)

    # Initialize Gemini
    use_embeddings = initialize_gemini()

    # Create index
    create_index_if_not_exists(es)

    # Index trials
    success, failed = bulk_index_trials(es, trials, use_embeddings)

    # Validate
    if success > 0:
        validate_indexing(es)

    print("\n" + "=" * 70)
    print("✓ Indexing complete!")
    print("=" * 70)
    print(f"\nIndexing Summary:")
    print(f"  • Total trials indexed: {success}")
    print(f"  • With embeddings: {'Yes (768-dim Gemini vectors)' if use_embeddings else 'No'}")
    print(f"  • Semantic search: {'Enabled' if use_embeddings else 'Disabled (keyword only)'}")
    print(f"\nNext steps:")
    print("1. Start your dev server: npm run dev")
    print("2. Navigate to Clinical Search")
    print("3. Try searching: 'diabetes trials' or 'cancer immunotherapy'")
    print("4. Toggle between Hybrid/Semantic/Keyword modes")
    print("\n✓ Your clinical trial intelligence platform is ready!")


if __name__ == "__main__":
    main()
