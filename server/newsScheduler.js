import cron from 'node-cron';
import { updateNews } from './newsScraperService.js';

let isRunning = false;

// Schedule news updates every 6 hours
// Cron pattern: '0 */6 * * *' = At minute 0 past every 6th hour
const CRON_SCHEDULE = '0 */6 * * *';

// For testing: every 30 minutes
// const CRON_SCHEDULE = '*/30 * * * *';

export function startNewsScheduler() {
  console.log('📅 Starting news scheduler...');
  console.log(`⏰ News will be fetched every 6 hours`);

  // Run immediately on startup
  runNewsUpdate();

  // Schedule periodic updates
  cron.schedule(CRON_SCHEDULE, () => {
    runNewsUpdate();
  });

  console.log('✓ News scheduler started successfully');
}

async function runNewsUpdate() {
  if (isRunning) {
    console.log('⏭️  News update already in progress, skipping...');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 Scheduled news update started at ${new Date().toLocaleString()}`);
    console.log('='.repeat(60));

    const news = await updateNews();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('='.repeat(60));
    console.log(`✓ News update completed in ${duration}s`);
    console.log(`📊 Total items: ${news.length}`);
    console.log(`⏰ Next update: ${getNextUpdateTime()}`);
    console.log(`${'='.repeat(60)}\n`);
  } catch (error) {
    console.error('❌ Scheduled news update failed:', error);
  } finally {
    isRunning = false;
  }
}

function getNextUpdateTime() {
  const now = new Date();
  const nextUpdate = new Date(now);

  // Calculate next 6-hour mark (0, 6, 12, 18)
  const currentHour = now.getHours();
  const nextHour = Math.ceil((currentHour + 1) / 6) * 6;

  nextUpdate.setHours(nextHour, 0, 0, 0);

  if (nextHour >= 24) {
    nextUpdate.setDate(nextUpdate.getDate() + 1);
    nextUpdate.setHours(0, 0, 0, 0);
  }

  return nextUpdate.toLocaleString();
}

export function stopNewsScheduler() {
  console.log('Stopping news scheduler...');
  cron.getTasks().forEach(task => task.stop());
}
