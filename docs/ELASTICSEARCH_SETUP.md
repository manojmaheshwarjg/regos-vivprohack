# Elasticsearch Cloud Setup Guide

This guide walks you through setting up Elasticsearch Cloud for the Clinical Trial Intelligence Platform.

## Overview

We'll use Elasticsearch Cloud (Elastic Cloud) to power our intelligent search with:
- Full-text search across 1,000+ clinical trials
- Semantic search with vector embeddings (768 dimensions)
- Real-time aggregations for filters
- Fast autocomplete suggestions
- Sub-second query response times

---

## Step 1: Create Elasticsearch Cloud Account

1. **Go to Elastic Cloud**: https://cloud.elastic.co/registration
2. **Sign up** for a free 14-day trial (no credit card required)
   - Or use an existing account if you have one
3. **Verify your email** address

---

## Step 2: Create a Deployment

1. **Log in** to https://cloud.elastic.co/
2. Click **"Create deployment"**
3. **Configure your deployment**:
   - **Name**: `clinical-trials-search` (or any name you prefer)
   - **Cloud provider**: Choose your preferred provider (AWS, GCP, or Azure)
   - **Region**: Select closest to your location (e.g., `us-east-1`, `europe-west1`)
   - **Version**: Use latest 8.x version (e.g., `8.12.0`)
   - **Deployment template**: Select **"General purpose"**
   - **Hardware profile**:
     - For development: 1GB RAM, 1 zone (Free tier)
     - For production: 4GB RAM, 2 zones (Recommended)

4. Click **"Create deployment"**
5. **IMPORTANT**: Save the credentials shown on the next screen:
   - `elastic` user password - **SAVE THIS NOW** (won't be shown again)
   - Cloud ID
   - Elasticsearch endpoint URL

---

## Step 3: Get Your Cloud ID and Create API Key

### Cloud ID

1. In your deployment dashboard, click on your deployment name
2. Copy the **Cloud ID** (looks like: `clinical-trials:dXMt...`)
3. Save this - you'll need it for the frontend configuration

### Create API Key (Recommended)

Using an API key is more secure than using the `elastic` user password.

1. **Open Kibana**:
   - In your deployment, click **"Open Kibana"**
   - Log in with username `elastic` and the password you saved

2. **Navigate to Stack Management**:
   - Click the hamburger menu (☰) in top left
   - Scroll down and click **"Stack Management"**
   - Under "Security", click **"API Keys"**

3. **Create API Key**:
   - Click **"Create API key"**
   - **Name**: `clinical-trials-frontend`
   - **Restrict privileges**: Leave unchecked (we need full access for now)
   - **Expiration**: Set to 1 year or leave indefinite
   - Click **"Create API key"**

4. **Copy the encoded key**:
   - Copy the **"Encoded"** key (long base64 string)
   - **SAVE THIS** - it won't be shown again
   - This is your `ES_API_KEY`

---

## Step 4: Configure Index Mapping

We need to create an index with proper mappings for our clinical trial data.

### Option A: Using Kibana Dev Tools (Easiest)

1. **Open Kibana** → Click hamburger menu (☰) → **"Dev Tools"**

2. **Create the index** with this mapping (paste into console):

```json
PUT /clinical_trials
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1,
    "analysis": {
      "analyzer": {
        "medical_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "medical_synonyms", "stemmer"]
        }
      },
      "filter": {
        "medical_synonyms": {
          "type": "synonym",
          "synonyms": [
            "mi, myocardial infarction, heart attack",
            "dm, diabetes mellitus, diabetes",
            "htn, hypertension, high blood pressure",
            "cvd, cardiovascular disease, heart disease",
            "copd, chronic obstructive pulmonary disease"
          ]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "nct_id": {
        "type": "keyword"
      },
      "brief_title": {
        "type": "text",
        "analyzer": "medical_analyzer",
        "fields": {
          "keyword": {
            "type": "keyword"
          }
        }
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
      "phase": {
        "type": "keyword"
      },
      "overall_status": {
        "type": "keyword"
      },
      "enrollment": {
        "type": "integer"
      },
      "source": {
        "type": "keyword"
      },
      "start_date": {
        "type": "date"
      },
      "completion_date": {
        "type": "date"
      },
      "primary_completion_date": {
        "type": "date"
      },
      "study_type": {
        "type": "keyword"
      },
      "gender": {
        "type": "keyword"
      },
      "minimum_age": {
        "type": "text"
      },
      "maximum_age": {
        "type": "text"
      },
      "conditions": {
        "type": "nested",
        "properties": {
          "condition_name": {
            "type": "text",
            "analyzer": "medical_analyzer"
          }
        }
      },
      "interventions": {
        "type": "nested",
        "properties": {
          "intervention_type": {
            "type": "keyword"
          },
          "intervention_name": {
            "type": "text",
            "analyzer": "medical_analyzer"
          }
        }
      },
      "facilities": {
        "type": "nested",
        "properties": {
          "facility_name": {
            "type": "text"
          },
          "city": {
            "type": "keyword"
          },
          "state": {
            "type": "keyword"
          },
          "country": {
            "type": "keyword"
          },
          "location": {
            "type": "geo_point"
          }
        }
      },
      "sponsors": {
        "type": "nested",
        "properties": {
          "name": {
            "type": "keyword"
          },
          "agency_class": {
            "type": "keyword"
          }
        }
      },
      "keywords": {
        "type": "text",
        "analyzer": "medical_analyzer"
      },
      "design_outcomes": {
        "type": "nested",
        "properties": {
          "outcome_type": {
            "type": "keyword"
          },
          "measure": {
            "type": "text"
          }
        }
      },
      "description_embedding": {
        "type": "dense_vector",
        "dims": 768,
        "index": true,
        "similarity": "cosine"
      },
      "quality_score": {
        "type": "float"
      },
      "indexed_at": {
        "type": "date"
      }
    }
  }
}
```

3. **Click the green play button** (▶) to execute

4. You should see a response: `"acknowledged": true`

### Option B: Using Python (Alternative)

If you prefer Python, the indexing script will create the index automatically.

---

## Step 5: Environment Configuration

Create a `.env.local` file in your project root:

```bash
# Elasticsearch Cloud Configuration
ES_CLOUD_ID=your_cloud_id_here
ES_API_KEY=your_api_key_here

# Alternative: use username/password (less secure)
# ES_USERNAME=elastic
# ES_PASSWORD=your_password_here

# Elasticsearch endpoint (optional, can be derived from Cloud ID)
ES_ENDPOINT=https://your-deployment.es.us-east-1.aws.found.io:443

# Gemini API for embeddings and NLP
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### Get your Gemini API Key

For generating embeddings and NLP features:

1. Go to https://makersuite.google.com/app/apikey
2. Create a new API key
3. Add it to `.env.local` as `VITE_GEMINI_API_KEY`

---

## Step 6: Install Dependencies

### Python Dependencies (for indexing)

```bash
pip install elasticsearch sentence-transformers python-dotenv tqdm
```

Or use requirements.txt:

```bash
pip install -r scripts/requirements.txt
```

### Frontend Dependencies

```bash
npm install @elastic/elasticsearch
```

---

## Step 7: Index Your Data

Run the Python indexing script:

```bash
python scripts/index_trials.py
```

This will:
- Read 1,000 trials from `dataset/clinical_trials.json`
- Generate embeddings for each trial
- Index into Elasticsearch Cloud
- Show progress bar
- Validate successful indexing

Expected output:
```
Loading clinical trials from dataset...
Loaded 1000 trials
Generating embeddings...
Embedding progress: 100%|████████████| 1000/1000
Indexing trials to Elasticsearch...
Indexing progress: 100%|████████████| 1000/1000
✓ Successfully indexed 1000 trials
✓ Index health: GREEN
```

---

## Step 8: Verify Setup

### Check Index in Kibana

1. Open **Kibana** → **Dev Tools**

2. **Check document count**:
```json
GET /clinical_trials/_count
```
Should return: `"count": 1000`

3. **Test search**:
```json
GET /clinical_trials/_search
{
  "query": {
    "match": {
      "brief_summaries_description": "diabetes"
    }
  },
  "size": 5
}
```

4. **Test aggregations**:
```json
GET /clinical_trials/_search
{
  "size": 0,
  "aggs": {
    "by_phase": {
      "terms": {
        "field": "phase"
      }
    },
    "by_status": {
      "terms": {
        "field": "overall_status"
      }
    }
  }
}
```

---

## Step 9: Test Frontend Connection

1. Start your dev server:
```bash
npm run dev
```

2. Navigate to the Clinical Search page

3. Try a search like "diabetes trials"

4. You should see:
   - Results loading from Elasticsearch
   - Real-time result counts
   - Fast response times (<500ms)

---

## Troubleshooting

### Error: "Unable to connect to Elasticsearch"

**Check:**
1. Cloud ID is correct in `.env.local`
2. API key has not expired
3. Deployment is running (check Elastic Cloud console)
4. Firewall/VPN not blocking requests

### Error: "Index not found"

**Solution:**
- Run the index mapping creation (Step 4)
- Or run the Python indexing script (Step 7)

### Error: "Authentication failed"

**Check:**
1. API key is correctly copied (no extra spaces)
2. API key hasn't been deleted in Kibana
3. Try using username/password instead

### Slow queries (>2 seconds)

**Solutions:**
1. Upgrade deployment size (4GB RAM recommended)
2. Reduce `size` parameter in queries
3. Enable query caching
4. Add more shards for parallel processing

### Embeddings failing

**Check:**
1. Gemini API key is valid
2. API quota not exceeded
3. Network connectivity to Google AI

**Fallback:**
- The app will work without embeddings (keyword search only)
- Semantic search features will be disabled

---

## Production Checklist

Before deploying to production:

- [ ] Upgrade to paid plan (free trial expires after 14 days)
- [ ] Enable 2+ availability zones for redundancy
- [ ] Increase RAM to 4GB+ for better performance
- [ ] Enable index lifecycle management (ILM) for old data
- [ ] Set up monitoring and alerting
- [ ] Configure IP filtering for security
- [ ] Use API keys with restricted privileges
- [ ] Enable audit logging
- [ ] Set up automated backups/snapshots
- [ ] Configure CORS properly for your domain

---

## Security Best Practices

1. **Never commit API keys** to git
   - Add `.env.local` to `.gitignore`
   - Use environment variables in CI/CD

2. **Use API keys** instead of username/password
   - Easier to rotate
   - Can restrict privileges

3. **Restrict API key privileges**:
   ```json
   {
     "indices": [
       {
         "names": ["clinical_trials"],
         "privileges": ["read", "view_index_metadata"]
       }
     ]
   }
   ```

4. **Enable IP filtering** in deployment settings
   - Restrict to your application's IP addresses

5. **Use HTTPS** always
   - Elasticsearch Cloud enforces this by default

---

## Cost Optimization

### Free Tier (14 days)
- 1GB RAM
- 8GB storage
- Perfect for development

### Recommended Production
- 4GB RAM ($95/month)
- 64GB storage
- 2 availability zones
- ~1000 queries/second

### Tips to Reduce Costs
1. Use smaller deployment for development
2. Delete old indices regularly
3. Compress source fields
4. Use filtered aliases
5. Enable ILM to archive old data

---

## Next Steps

After setup is complete:

1. ✓ Elasticsearch Cloud deployment running
2. ✓ Index created with proper mappings
3. ✓ 1,000 trials indexed successfully
4. ✓ Frontend connected and searching

Now proceed to:
- Test all 23 intelligence features
- Fine-tune ranking algorithms
- Optimize query performance
- Deploy to production

---

## Useful Links

- **Elasticsearch Docs**: https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html
- **JavaScript Client**: https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/index.html
- **Query DSL**: https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html
- **Aggregations**: https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations.html
- **Vector Search**: https://www.elastic.co/guide/en/elasticsearch/reference/current/knn-search.html
- **Elastic Cloud Console**: https://cloud.elastic.co/

---

## Support

If you encounter issues:
1. Check the Elasticsearch logs in Kibana
2. Review the Python script logs
3. Test queries in Kibana Dev Tools
4. Check Elastic Cloud deployment health
5. Contact Elastic Support (paid plans)

Happy searching!
