import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

const DATA_FILE = path.join(__dirname, 'data', 'regulatory_news.json');

// Company configurations
const SOURCES = {
  pfizer: {
    name: 'Pfizer',
    type: 'rss',
    url: 'https://www.pfizer.com/newsfeed',
    parser: parsePfizerRSS
  },
  jnj: {
    name: 'Johnson & Johnson',
    type: 'scrape',
    url: 'https://www.jnj.com/media-center/press-releases',
    parser: scrapeJNJ
  },
  merck: {
    name: 'Merck',
    type: 'scrape',
    url: 'https://www.merck.com/media/news/',
    parser: scrapeMerck
  },
  abbvie: {
    name: 'AbbVie',
    type: 'scrape',
    url: 'https://news.abbvie.com/news/press-releases',
    parser: scrapeAbbVie
  },
  astrazeneca: {
    name: 'AstraZeneca',
    type: 'scrape',
    url: 'https://www.astrazeneca.com/media-centre/press-releases.html',
    parser: scrapeAstraZeneca
  }
};

// Parse Pfizer RSS feed
async function parsePfizerRSS() {
  try {
    const feed = await parser.parseURL(SOURCES.pfizer.url);
    return feed.items.slice(0, 20).map(item => ({
      id: generateId(item.link),
      title: item.title,
      company: 'Pfizer',
      category: categorizeNews(item.title, item.contentSnippet || item.content),
      summary: extractSummary(item.contentSnippet || item.content || item.title),
      publishedDate: item.pubDate || item.isoDate,
      url: item.link,
      tags: extractTags(item.title, item.contentSnippet || item.content)
    }));
  } catch (error) {
    console.error('Pfizer RSS error:', error.message);
    return [];
  }
}

// Scrape J&J press releases
async function scrapeJNJ() {
  try {
    const response = await axios.get(SOURCES.jnj.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000
    });
    const $ = cheerio.load(response.data);
    const items = [];

    // Try multiple strategies for J&J
    const selectors = [
      'article',
      'div[class*="press"]',
      'div[class*="release"]',
      'div[class*="news"]',
      'li[class*="item"]',
      'a[href*="press-release"]'
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`J&J: Found ${elements.length} items with selector: ${selector}`);
        elements.slice(0, 20).each((i, elem) => {
          // Try to extract title from multiple possible locations
          let title = $(elem).find('h1, h2, h3, h4, .title, .headline').first().text().trim();
          if (!title) title = $(elem).text().trim().split('\n')[0];

          // Try to extract link
          let link = $(elem).attr('href') || $(elem).find('a').first().attr('href');

          // Try to extract date
          const date = $(elem).find('time, .date, span[class*="date"]').first().text().trim() ||
                       $(elem).find('time').attr('datetime') || new Date().toISOString();

          // Try to extract summary
          const summary = $(elem).find('p, .summary, .excerpt, .description').first().text().trim();

          if (title && link && title.length > 10) {
            items.push({
              id: generateId(link),
              title,
              company: 'Johnson & Johnson',
              category: categorizeNews(title, summary),
              summary: extractSummary(summary || title),
              publishedDate: date,
              url: link.startsWith('http') ? link : `https://www.jnj.com${link}`,
              tags: extractTags(title, summary)
            });
          }
        });
        if (items.length > 0) break;
      }
    }

    return items;
  } catch (error) {
    console.error('J&J scraping error:', error.message);
    return [];
  }
}

// Scrape AbbVie press releases
async function scrapeAbbVie() {
  try {
    const response = await axios.get(SOURCES.abbvie.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000
    });
    const $ = cheerio.load(response.data);
    const items = [];

    // Try multiple strategies for AbbVie
    const selectors = [
      'article',
      'div[class*="press"]',
      'div[class*="release"]',
      'div[class*="news"]',
      'li[class*="item"]',
      'a[href*="press-release"]',
      'div.wd_item'
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`AbbVie: Found ${elements.length} items with selector: ${selector}`);
        elements.slice(0, 20).each((i, elem) => {
          // Try to extract title from multiple possible locations
          let title = $(elem).find('h1, h2, h3, h4, .title, .headline, .wd_title').first().text().trim();
          if (!title) title = $(elem).text().trim().split('\n')[0];

          // Try to extract link
          let link = $(elem).attr('href') || $(elem).find('a').first().attr('href');

          // Try to extract date
          const date = $(elem).find('time, .date, span[class*="date"], .wd_date').first().text().trim() ||
                       $(elem).find('time').attr('datetime') || new Date().toISOString();

          // Try to extract summary
          const summary = $(elem).find('p, .summary, .excerpt, .description, .wd_summary').first().text().trim();

          if (title && link && title.length > 10) {
            items.push({
              id: generateId(link),
              title,
              company: 'AbbVie',
              category: categorizeNews(title, summary),
              summary: extractSummary(summary || title),
              publishedDate: date,
              url: link.startsWith('http') ? link : `https://news.abbvie.com${link}`,
              tags: extractTags(title, summary)
            });
          }
        });
        if (items.length > 0) break;
      }
    }

    return items;
  } catch (error) {
    console.error('AbbVie scraping error:', error.message);
    return [];
  }
}

// Scrape Merck news page
async function scrapeMerck() {
  try {
    const response = await axios.get(SOURCES.merck.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000
    });
    const $ = cheerio.load(response.data);
    const items = [];

    // Strategy 1: Find all links with relevant paths
    console.log('Merck: Trying link-based strategy...');
    $('a[href*="/media/"], a[href*="/news/"], a[href*="press"]').slice(0, 20).each((i, elem) => {
      const link = $(elem).attr('href');
      let title = $(elem).text().trim();

      // Look for title in parent elements if link text is too short
      if (!title || title.length < 15) {
        title = $(elem).closest('article, div, li').find('h1, h2, h3, h4, .title').first().text().trim();
      }

      const date = $(elem).closest('article, div, li').find('time, .date, span[class*="date"]').first().text().trim() ||
                   $(elem).closest('article, div, li').find('time').attr('datetime') || new Date().toISOString();

      const summary = $(elem).closest('article, div, li').find('p, .summary, .description').first().text().trim();

      // Filter out navigation and utility links
      const excludePatterns = /^(read more|learn more|click here|company statements|media library|contacts|fact sheet|subscribe|sign up|view all|explore|social media|guidelines|archive)$/i;

      if (title && link && title.length > 15 && !excludePatterns.test(title.trim())) {
        console.log(`Merck: Found - "${title.substring(0, 50)}..."`);
        items.push({
          id: generateId(link),
          title,
          company: 'Merck',
          category: categorizeNews(title, summary),
          summary: extractSummary(summary || title),
          publishedDate: date,
          url: link.startsWith('http') ? link : `https://www.merck.com${link}`,
          tags: extractTags(title, summary)
        });
      }
    });

    return items;
  } catch (error) {
    console.error('Merck scraping error:', error.message);
    return [];
  }
}

// Scrape AstraZeneca news page
async function scrapeAstraZeneca() {
  try {
    const response = await axios.get(SOURCES.astrazeneca.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000
    });
    const $ = cheerio.load(response.data);
    const items = [];

    // Strategy 1: Find all links with relevant paths
    console.log('AstraZeneca: Trying link-based strategy...');
    $('a[href*="/media-centre/"], a[href*="/press-releases/"], a[href*="press"]').slice(0, 20).each((i, elem) => {
      const link = $(elem).attr('href');
      let title = $(elem).text().trim();

      // Look for title in parent elements if link text is too short
      if (!title || title.length < 15) {
        title = $(elem).closest('article, div, li').find('h1, h2, h3, h4, .title').first().text().trim();
      }

      const date = $(elem).closest('article, div, li').find('time, .date, span[class*="date"]').first().text().trim() ||
                   $(elem).closest('article, div, li').find('time').attr('datetime') || new Date().toISOString();

      const summary = $(elem).closest('article, div, li').find('p, .summary, .description').first().text().trim();

      // Filter out navigation and utility links
      const excludePatterns = /^(read more|learn more|click here|feature|view global|contacts|subscribe|sign up|view all|explore|archive|social media|guidelines|community guidelines)$/i;

      if (title && link && title.length > 15 && !excludePatterns.test(title.trim())) {
        console.log(`AstraZeneca: Found - "${title.substring(0, 50)}..."`);
        items.push({
          id: generateId(link),
          title,
          company: 'AstraZeneca',
          category: categorizeNews(title, summary),
          summary: extractSummary(summary || title),
          publishedDate: date,
          url: link.startsWith('http') ? link : `https://www.astrazeneca.com${link}`,
          tags: extractTags(title, summary)
        });
      }
    });

    return items;
  } catch (error) {
    console.error('AstraZeneca scraping error:', error.message);
    return [];
  }
}

// Helper: Generate unique ID from URL
function generateId(url) {
  return Buffer.from(url).toString('base64').substring(0, 16);
}

// Helper: Extract summary (first 200 chars)
function extractSummary(text) {
  if (!text) return '';
  const clean = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return clean.length > 200 ? clean.substring(0, 200) + '...' : clean;
}

// Helper: Categorize news based on keywords
function categorizeNews(title, content) {
  const text = `${title} ${content}`.toLowerCase();

  if (text.match(/fda|approval|authorized|cleared|indication/i)) {
    return 'FDA Approval';
  } else if (text.match(/clinical trial|phase \d|study|patient|enrollment/i)) {
    return 'Clinical Trial';
  } else if (text.match(/partnership|collaboration|agreement|acquisition|merger/i)) {
    return 'Partnership';
  } else if (text.match(/earnings|revenue|financial|quarter|guidance/i)) {
    return 'Financial';
  } else if (text.match(/pipeline|development|research|innovation/i)) {
    return 'R&D';
  } else if (text.match(/policy|regulation|guidance|compliance/i)) {
    return 'Policy Update';
  } else if (text.match(/safety|warning|recall|adverse/i)) {
    return 'Safety Alert';
  } else {
    return 'General News';
  }
}

// Helper: Extract relevant tags
function extractTags(title, content) {
  const text = `${title} ${content}`.toLowerCase();
  const tags = [];

  const tagKeywords = {
    'Oncology': /cancer|oncology|tumor|chemotherapy/i,
    'Cardiovascular': /heart|cardio|hypertension|cholesterol/i,
    'Diabetes': /diabetes|insulin|glucose/i,
    'Vaccines': /vaccine|immunization/i,
    'Rare Disease': /rare disease|orphan drug/i,
    'COVID-19': /covid|coronavirus|pandemic/i,
    'Biosimilar': /biosimilar|generic/i,
    'Digital Health': /digital|app|ai|artificial intelligence/i
  };

  for (const [tag, regex] of Object.entries(tagKeywords)) {
    if (regex.test(text)) {
      tags.push(tag);
    }
  }

  return tags.slice(0, 3); // Limit to 3 tags
}

// Main fetch function
async function fetchAllNews() {
  console.log('📰 Fetching regulatory news from all sources...');
  const startTime = Date.now();

  const results = await Promise.allSettled([
    SOURCES.pfizer.parser(),
    SOURCES.jnj.parser(),
    SOURCES.merck.parser(),
    SOURCES.abbvie.parser(),
    SOURCES.astrazeneca.parser()
  ]);

  let allNews = [];
  results.forEach((result, idx) => {
    const source = Object.keys(SOURCES)[idx];
    if (result.status === 'fulfilled') {
      console.log(`✓ ${SOURCES[source].name}: ${result.value.length} items`);
      allNews = allNews.concat(result.value);
    } else {
      console.log(`✗ ${SOURCES[source].name}: Failed`);
    }
  });

  // Deduplicate by URL
  const uniqueNews = Array.from(new Map(allNews.map(item => [item.url, item])).values());

  // Sort by date (newest first)
  uniqueNews.sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate));

  console.log(`📊 Total unique news items: ${uniqueNews.length}`);
  console.log(`⏱️  Fetch completed in ${Date.now() - startTime}ms`);

  return uniqueNews;
}

// Save news to JSON file
async function saveNewsToFile(news) {
  try {
    const data = {
      lastUpdated: new Date().toISOString(),
      count: news.length,
      items: news
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('💾 News saved to file');
  } catch (error) {
    console.error('Error saving news:', error);
  }
}

// Load news from JSON file
async function loadNewsFromFile() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.items || [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No existing news file found');
      return [];
    }
    console.error('Error loading news:', error);
    return [];
  }
}

// Main update function
async function updateNews() {
  try {
    const news = await fetchAllNews();
    await saveNewsToFile(news);
    return news;
  } catch (error) {
    console.error('Error updating news:', error);
    return await loadNewsFromFile(); // Return cached data on error
  }
}

export {
  updateNews,
  loadNewsFromFile,
  fetchAllNews,
  saveNewsToFile
};
