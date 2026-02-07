/**
 * Express API Server for Elasticsearch Proxy
 *
 * This server handles Elasticsearch requests from the frontend,
 * keeping API credentials secure on the server side.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Client } from '@elastic/elasticsearch';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const app = express();
const port = 3002;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize Elasticsearch client
const esClient = new Client({
  cloud: {
    id: process.env.ES_CLOUD_ID
  },
  auth: {
    apiKey: process.env.ES_API_KEY
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const health = await esClient.ping();
    res.json({ status: 'ok', elasticsearch: health });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Search endpoint
app.post('/api/search', async (req, res) => {
  try {
    const { index = 'clinical_trials', body } = req.body;

    console.log('🔍 Search request:', JSON.stringify(body, null, 2));

    const result = await esClient.search({
      index,
      body
    });

    console.log(`✓ Found ${result.hits.total.value} results`);

    res.json(result);
  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({
      error: error.message,
      details: error.meta?.body || error
    });
  }
});

// Count endpoint
app.post('/api/count', async (req, res) => {
  try {
    const { index = 'clinical_trials', body } = req.body;

    const result = await esClient.count({
      index,
      body
    });

    res.json(result);
  } catch (error) {
    console.error('❌ Count error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Aggregations endpoint
app.post('/api/aggregations', async (req, res) => {
  try {
    const { index = 'clinical_trials', body } = req.body;

    const result = await esClient.search({
      index,
      body: {
        size: 0,
        ...body
      }
    });

    res.json(result.aggregations);
  } catch (error) {
    console.error('❌ Aggregations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get document by ID
app.get('/api/document/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { index = 'clinical_trials' } = req.query;

    const result = await esClient.get({
      index,
      id
    });

    res.json(result);
  } catch (error) {
    console.error('❌ Get document error:', error);
    res.status(404).json({ error: error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`\n✓ Elasticsearch API server running on http://localhost:${port}`);
  console.log(`✓ Search endpoint: POST http://localhost:${port}/api/search`);
  console.log(`✓ Health check: GET http://localhost:${port}/api/health\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing Elasticsearch client...');
  await esClient.close();
  process.exit(0);
});
