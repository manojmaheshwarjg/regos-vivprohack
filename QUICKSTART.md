# Quick Start Guide: Setting Up Elasticsearch

Follow these steps to connect your clinical trials platform to Elasticsearch Cloud.

## Step 1: Get Your Elasticsearch Credentials

You mentioned you have the Elasticsearch API. You'll need two pieces of information:

### Option A: Cloud ID + API Key (Recommended)

1. **Cloud ID**: Found in your Elastic Cloud deployment page
   - Format: `deployment-name:base64encodedstring`
   - Example: `clinical-trials:dXMtZWFzdC0xLmF3cy5mb3VuZC5pbyRhYmNkZWY=`

2. **API Key**: Create in Kibana → Stack Management → API Keys
   - Click "Create API key"
   - Name it `clinical-trials-app`
   - Copy the encoded key (long base64 string)

### Option B: Cloud ID + Password (Alternative)

1. **Cloud ID**: Same as above
2. **Password**: The `elastic` user password from deployment setup

---

## Step 2: Add Credentials to .env.local

Open your `.env.local` file and add these lines:

```bash
# Elasticsearch Cloud Configuration
ES_CLOUD_ID=your_cloud_id_here
ES_API_KEY=your_api_key_here

# If using password instead of API key:
# ES_USERNAME=elastic
# ES_PASSWORD=your_password_here

# Gemini API Key (for embeddings and NLP)
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### Getting Gemini API Key

If you don't have a Gemini API key:
1. Go to https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key and paste it in `.env.local`

---

## Step 3: Install Python Dependencies

```bash
pip install elasticsearch google-generativeai python-dotenv tqdm
```

Or use the requirements file:

```bash
pip install -r scripts/requirements.txt
```

---

## Step 4: Test Your Connection

Run the test script to verify everything works:

```bash
python scripts/test_es_connection.py
```

### What You Should See

**If successful:**
```
✓ Successfully connected to Elasticsearch!
✓ Cluster name: your-cluster
✓ Elasticsearch version: 8.x.x
⚠️  Index 'clinical_trials' does not exist yet
```

**If there's an error:**
- Check that Cloud ID and API Key are correct
- Verify deployment is running in Elastic Cloud
- Check network connectivity

---

## Step 5: Index Your Data

Once the connection test passes, run the indexing script:

```bash
python scripts/index_trials_gemini.py
```

### What This Does

1. Loads 1,000 clinical trials from `dataset/clinical_trials.json`
2. Generates 768-dimensional embeddings using Gemini API (~10-15 minutes)
3. Calculates quality scores for each trial
4. Bulk indexes everything into Elasticsearch Cloud

### Progress Output

```
Loading clinical trials from dataset...
✓ Loaded 1000 trials

Generating embeddings using Gemini API...
Generating embeddings: 100%|████████████| 1000/1000

Indexing documents to Elasticsearch...
Indexing progress: 100%|████████████| 1000/1000

✓ Successfully indexed 1000 trials
✓ Index health: GREEN
```

---

## Step 6: Verify Indexing

Run the test script again to confirm data is indexed:

```bash
python scripts/test_es_connection.py
```

You should now see:
```
✓ Index 'clinical_trials' exists!
  → Documents: 1000
  → Size: XX.XX MB
  → Embeddings: ✓ (768 dimensions)
```

---

## Step 7: Start the Frontend

```bash
npm run dev
```

Then navigate to:
- http://localhost:3000

Click on "Explore" → "Discovery" to access the Clinical Intelligence Search

---

## Testing Your Setup

### Test Search Modes

Try these searches to verify everything works:

**1. Keyword Search:**
- "diabetes trials"
- Should find exact keyword matches

**2. Hybrid Search (default):**
- "heart attack prevention"
- Should find "myocardial infarction" trials (semantic understanding)

**3. Semantic Search:**
- Toggle to "SEMANTIC" mode
- "gene therapy blood disorders"
- Should find CRISPR sickle cell trials even with different terminology

**4. Filters:**
- Use left sidebar to filter by Phase, Status, Sponsor
- Numbers should update in real-time from Elasticsearch aggregations

---

## Troubleshooting

### Connection Test Fails

**Error: "ES_CLOUD_ID not found"**
- Solution: Add ES_CLOUD_ID to .env.local

**Error: "Authentication failed"**
- Solution: Check API key hasn't expired
- Try using username/password instead

**Error: "Unable to connect"**
- Check deployment is running in Elastic Cloud console
- Verify no VPN/firewall blocking the connection

### Indexing Fails

**Error: "GEMINI_API_KEY not found"**
- Solution: Add VITE_GEMINI_API_KEY to .env.local
- Or the script will skip embeddings (keyword-only search)

**Error: "Quota exceeded"**
- Gemini API free tier: 1,500 requests/minute
- Script is rate-limited to 1,200/minute
- Wait a few minutes and try again

**Slow indexing**
- Normal: ~10-15 minutes for 1,000 trials
- Gemini API calls + network latency
- Progress bar shows current status

### Frontend Shows No Results

1. Check browser console for errors
2. Verify Elasticsearch connection in console logs
3. Try keyword-only mode first (no embeddings needed)
4. Check `.env.local` has correct credentials

---

## Quick Reference

### File Locations

- **Config**: `.env.local`
- **Dataset**: `dataset/clinical_trials.json` (1,000 trials)
- **Test**: `scripts/test_es_connection.py`
- **Index**: `scripts/index_trials_gemini.py`
- **Docs**: `docs/ELASTICSEARCH_SETUP.md` (detailed guide)

### Common Commands

```bash
# Test connection
python scripts/test_es_connection.py

# Index data
python scripts/index_trials_gemini.py

# Start frontend
npm run dev

# View Elasticsearch in Kibana
# https://your-deployment.kb.region.cloud.provider.io
```

---

## What's Next?

Once everything is working:

1. ✅ Test all three search modes (Hybrid, Semantic, Keyword)
2. ✅ Try complex queries: "Phase 3 diabetes trials in adults recruiting"
3. ✅ Use filters to narrow results
4. ✅ Check match reasons and relevance scores
5. ✅ Verify semantic understanding: "MI prevention" finds "myocardial infarction"

---

## Support

If you encounter issues:
1. Check `docs/ELASTICSEARCH_SETUP.md` for detailed setup
2. Run test script to isolate the problem
3. Check Elasticsearch deployment health in Cloud console
4. Verify Gemini API quota/key validity

Your clinical trial intelligence platform is ready! 🎉
