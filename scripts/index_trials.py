#!/usr/bin/env python3
"""
Clinical Trials Elasticsearch Indexing Script

This script:
1. Loads clinical trials from dataset/clinical_trials.json
2. Generates semantic embeddings for trial descriptions
3. Calculates quality scores
4. Bulk indexes into Elasticsearch Cloud
5. Validates successful indexing

Usage:
    python scripts/index_trials.py

Requirements:
    pip install elasticsearch sentence-transformers python-dotenv tqdm
"""

import json
import os
import sys
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path

# Try to import required packages
try:
    from elasticsearch import Elasticsearch, helpers
    from sentence_transformers import SentenceTransformer
    from tqdm import tqdm
    from dotenv import load_dotenv
except ImportError as e:
    print(f"❌ Missing required package: {e}")
    print("\nPlease install dependencies:")
    print("  pip install elasticsearch sentence-transformers python-dotenv tqdm")
    sys.exit(1)

# Load environment variables
load_dotenv('.env.local')

# Configuration
DATASET_PATH = 'dataset/clinical_trials.json'
INDEX_NAME = 'clinical_trials'
BATCH_SIZE = 100

# Elasticsearch configuration
ES_CLOUD_ID = os.getenv('ES_CLOUD_ID')
ES_API_KEY = os.getenv('ES_API_KEY')
ES_USERNAME = os.getenv('ES_USERNAME', 'elastic')
ES_PASSWORD = os.getenv('ES_PASSWORD')


def load_embedding_model():
    """Load sentence transformer model for generating embeddings."""
    print("Loading embedding model (this may take a moment on first run)...")
    # Using a medical domain model for better accuracy
    # Alternative: 'all-MiniLM-L6-v2' (faster, smaller)
    try:
        model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')
        print("✓ Embedding model loaded (768 dimensions)")
        return model
    except Exception as e:
        print(f"⚠️  Warning: Could not load embedding model: {e}")
        print("Proceeding without embeddings (semantic search will be disabled)")
        return None


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
    source = trial.get('source', '').lower()
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
            start_year = int(start_date[:4])
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
    """
    parts = []

    # Title (most important)
    if trial.get('brief_title'):
        parts.append(trial['brief_title'])

    # Summary description
    if trial.get('brief_summaries_description'):
        parts.append(trial['brief_summaries_description'])

    # Conditions
    if trial.get('conditions'):
        conditions_text = ' '.join([
            c.get('condition_name', '') if isinstance(c, dict) else str(c)
            for c in trial['conditions']
        ])
        parts.append(conditions_text)

    # Interventions
    if trial.get('interventions'):
        interventions_text = ' '.join([
            i.get('intervention_name', '') if isinstance(i, dict) else str(i)
            for i in trial['interventions']
        ])
        parts.append(interventions_text)

    # Keywords
    if trial.get('keywords'):
        if isinstance(trial['keywords'], list):
            parts.append(' '.join(trial['keywords']))
        else:
            parts.append(str(trial['keywords']))

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
    if embedding is not None:
        doc['description_embedding'] = embedding

    return doc


def create_index_if_not_exists(es: Elasticsearch):
    """
    Create index with proper mappings if it doesn't exist.
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

    print(f"Creating index '{INDEX_NAME}' with mappings...")

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
                    "dims": 768,
                    "index": True,
                    "similarity": "cosine"
                },
                "quality_score": {"type": "float"},
                "indexed_at": {"type": "date"}
            }
        }
    }

    es.indices.create(index=INDEX_NAME, body=index_body)
    print(f"✓ Index '{INDEX_NAME}' created successfully")


def bulk_index_trials(es: Elasticsearch, trials: List[Dict], model: SentenceTransformer = None):
    """
    Bulk index trials into Elasticsearch with embeddings.
    """
    print(f"\nIndexing {len(trials)} trials...")

    # Generate embeddings if model is available
    embeddings = None
    if model:
        print("Generating embeddings (this may take a few minutes)...")
        texts = [generate_searchable_text(trial) for trial in trials]
        try:
            embeddings = model.encode(texts, show_progress_bar=True, batch_size=32)
            print(f"✓ Generated {len(embeddings)} embeddings")
        except Exception as e:
            print(f"⚠️  Warning: Failed to generate embeddings: {e}")
            embeddings = None

    # Prepare documents for bulk indexing
    actions = []
    for i, trial in enumerate(trials):
        embedding = embeddings[i].tolist() if embeddings is not None else None
        doc = transform_trial_for_indexing(trial, embedding)

        action = {
            "_index": INDEX_NAME,
            "_id": trial.get('nct_id'),
            "_source": doc
        }
        actions.append(action)

    # Bulk index with progress bar
    print("Indexing documents...")
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
    print("=" * 60)
    print("Clinical Trials Elasticsearch Indexing")
    print("=" * 60)

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

    # Load embedding model
    model = load_embedding_model()

    # Create index
    create_index_if_not_exists(es)

    # Index trials
    success, failed = bulk_index_trials(es, trials, model)

    # Validate
    if success > 0:
        validate_indexing(es)

    print("\n" + "=" * 60)
    print("✓ Indexing complete!")
    print("=" * 60)
    print(f"\nNext steps:")
    print("1. Start your dev server: npm run dev")
    print("2. Navigate to Clinical Search")
    print("3. Try searching: 'diabetes trials' or 'cancer immunotherapy'")
    print("\n✓ Your clinical trial intelligence platform is ready!")


if __name__ == "__main__":
    main()
