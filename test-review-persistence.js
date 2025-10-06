#!/usr/bin/env node

/**
 * Automated Review Persistence Test
 * Tests that reviews survive server restarts
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const API_BASE = 'http://localhost:3000/api';
const WEB_BASE = 'http://localhost:3001';

const TEST_PRODUCT_ID = '507f1f77bcf86cd799439011'; // MongoDB ObjectId format
const TEST_REVIEW = {
  rating: 5,
  title: 'Test Review - Persistence Test',
  body: 'This review tests if reviews persist after server restart',
  authorName: 'Test User',
  authorEmail: 'test@example.com'
};

let serverProcess = null;
let testAttempts = 0;
const MAX_ATTEMPTS = 5;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function waitForServer(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await makeRequest(url);
      if (response.status < 500) {
        console.log(`✅ Server ready at ${url}`);
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    console.log(`⏳ Waiting for server... (${i + 1}/${maxAttempts})`);
    await sleep(2000);
  }
  return false;
}

async function startServer() {
  console.log('🚀 Starting development server...');

  return new Promise((resolve, reject) => {
    // Kill any existing processes on the ports first
    try {
      execSync('npx kill-port 3000 3001', { stdio: 'inherit' });
    } catch (e) {
      // Ignore if ports aren't in use
    }

    // Start the servers
    serverProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'pipe',
      shell: true,
      detached: true
    });

    let startupTimeout = setTimeout(() => {
      if (!serverProcess.killed) {
        console.log('⚠️ Server startup timeout, but continuing...');
        resolve();
      }
    }, 15000);

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('📄 Server output:', output.trim());

      if (output.includes('API server listening') ||
          output.includes('Ready') ||
          output.includes('started') ||
          output.includes('listening')) {
        console.log('✅ Server started');
        clearTimeout(startupTimeout);
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error('❌ Server error:', output.trim());
    });
  });
}

async function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    console.log('🛑 Stopping server...');
    process.kill(-serverProcess.pid);
    await sleep(3000);
  }
}

async function submitReview() {
  console.log('📝 Submitting test review...');

  try {
    const response = await makeRequest(`${API_BASE}/products/${TEST_PRODUCT_ID}/reviews`, {
      method: 'POST',
      body: TEST_REVIEW
    });

    if (response.status === 201) {
      console.log('✅ Review submitted successfully');
      return response.data;
    } else {
      console.log(`❌ Failed to submit review: ${response.status}`, response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Error submitting review:', error.message);
    return null;
  }
}

async function checkReviewExists() {
  console.log('🔍 Checking if review exists...');

  try {
    const response = await makeRequest(`${API_BASE}/products/${TEST_PRODUCT_ID}/reviews`);

    if (response.status === 200 && response.data) {
      const reviews = response.data.items || [];
      const testReview = reviews.find(r =>
        r.title === TEST_REVIEW.title &&
        r.body === TEST_REVIEW.body
      );

      if (testReview) {
        console.log('✅ Review found after restart');
        return true;
      } else {
        console.log('❌ Review not found after restart');
        return false;
      }
    } else {
      console.log(`❌ Failed to fetch reviews: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Error checking review:', error.message);
    return false;
  }
}

async function checkDataFile() {
  const dataFile = path.join(__dirname, 'apps/api/data/reviews.json');

  try {
    if (fs.existsSync(dataFile)) {
      const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
      const reviews = data.reviews || [];

      if (reviews.length > 0) {
        console.log(`✅ Data file exists with ${reviews.length} reviews`);
        return true;
      } else {
        console.log('❌ Data file exists but no reviews found');
        return false;
      }
    } else {
      console.log('❌ Data file does not exist');
      return false;
    }
  } catch (error) {
    console.log('❌ Error reading data file:', error.message);
    return false;
  }
}

async function runTest() {
  testAttempts++;
  console.log(`\n🧪 Test Attempt ${testAttempts}/${MAX_ATTEMPTS}`);
  console.log('=' .repeat(50));

  try {
    // Start server
    await startServer();

    // Wait for server to be ready
    if (!(await waitForServer(`${API_BASE}/products/${TEST_PRODUCT_ID}/reviews`))) {
      throw new Error('Server failed to start');
    }

    // Submit a review
    const reviewData = await submitReview();
    if (!reviewData) {
      throw new Error('Failed to submit review');
    }

    // Check if data file was created
    if (!(await checkDataFile())) {
      throw new Error('Data file not created');
    }

    // Stop server
    await stopServer();

    // Wait a bit before restarting
    await sleep(2000);

    // Restart server
    await startServer();
    await waitForServer(`${API_BASE}/products/${TEST_PRODUCT_ID}/reviews`);

    // Check if review still exists
    if (await checkReviewExists()) {
      console.log('\n🎉 SUCCESS: Review persistence is working!');
      await stopServer();
      process.exit(0);
    } else {
      throw new Error('Review not found after restart');
    }

  } catch (error) {
    console.log(`❌ Test attempt ${testAttempts} failed:`, error.message);

    if (testAttempts < MAX_ATTEMPTS) {
      console.log(`🔄 Retrying in 3 seconds...`);
      await sleep(3000);
      await stopServer();
      await runTest();
    } else {
      console.log(`\n💥 FAILED: Review persistence not working after ${MAX_ATTEMPTS} attempts`);
      await stopServer();
      process.exit(1);
    }
  }
}

async function main() {
  console.log('🔬 Starting Automated Review Persistence Test');
  console.log('This test will verify that reviews survive server restarts\n');

  // Check if we're in the right directory
  if (!fs.existsSync('apps/api')) {
    console.error('❌ Please run this script from the project root directory');
    process.exit(1);
  }

  await runTest();
}

// Handle script interruption
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted');
  await stopServer();
  process.exit(0);
});

main().catch(console.error);
