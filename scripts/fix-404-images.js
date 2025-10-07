#!/usr/bin/env node

/**
 * Script to fix 404 images in seed-image-map.json
 * - Extracts all image URLs
 * - Checks for 404 errors
 * - Removes broken URLs
 * - Replaces with working alternatives
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Read the seed image map
const seedMapPath = path.join(__dirname, '../apps/api/seed-image-map.json');
const seedMap = JSON.parse(fs.readFileSync(seedMapPath, 'utf8'));

console.log(`Loaded ${Object.keys(seedMap).length} image mappings`);

// Extract all unique external URLs
const externalUrls = Object.keys(seedMap);
const uniqueUrls = [...new Set(externalUrls)];

console.log(`Found ${uniqueUrls.length} unique external URLs`);

// Function to check if URL returns 404
function checkUrlStatus(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;

    const req = protocol.request(url, { method: 'HEAD' }, (res) => {
      resolve({
        url,
        status: res.statusCode,
        is404: res.statusCode === 404
      });
    });

    req.on('error', () => {
      resolve({
        url,
        status: 'error',
        is404: true // Treat errors as 404s
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        url,
        status: 'timeout',
        is404: true
      });
    });

    req.end();
  });
}

// Check all URLs for 404 status
async function checkAllUrls() {
  console.log('Checking URLs for 404 status...');

  const results = [];
  const batchSize = 10; // Check 10 URLs at a time

  for (let i = 0; i < uniqueUrls.length; i += batchSize) {
    const batch = uniqueUrls.slice(i, i + batchSize);
    console.log(`Checking batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueUrls.length / batchSize)}`);

    const batchResults = await Promise.all(batch.map(checkUrlStatus));
    results.push(...batchResults);

    // Small delay between batches to be respectful
    if (i + batchSize < uniqueUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

// Find working replacement URLs from the same domain
function findReplacementUrl(brokenUrl, allResults) {
  try {
    const url = new URL(brokenUrl);
    const domain = url.hostname;

    // Find other working URLs from the same domain
    const sameDomainUrls = allResults.filter(result =>
      result.url !== brokenUrl &&
      !result.is404 &&
      new URL(result.url).hostname === domain
    );

    if (sameDomainUrls.length > 0) {
      // Return a random working URL from the same domain
      return sameDomainUrls[Math.floor(Math.random() * sameDomainUrls.length)].url;
    }

    // If no same-domain URLs work, find any working URL
    const workingUrls = allResults.filter(result =>
      result.url !== brokenUrl &&
      !result.is404
    );

    if (workingUrls.length > 0) {
      return workingUrls[Math.floor(Math.random() * workingUrls.length)].url;
    }

    return null;
  } catch (error) {
    console.error(`Error finding replacement for ${brokenUrl}:`, error);
    return null;
  }
}

// Generate a new placeholder URL
function generatePlaceholderUrl(width = 1200, height = 800) {
  const colors = ['007acc', '28a745', 'dc3545', 'ffc107', '6f42c1', 'fd7e14', '20c997', 'e83e8c'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const text = encodeURIComponent('Image Unavailable');
  return `https://placehold.co/${width}x${height}/${color}/ffffff?text=${text}`;
}

// Main execution
async function main() {
  try {
    // Check all URLs
    const results = await checkAllUrls();

    // Count 404s
    const brokenUrls = results.filter(r => r.is404);
    console.log(`\nFound ${brokenUrls.length} broken URLs out of ${results.length}`);

    if (brokenUrls.length === 0) {
      console.log('No broken URLs found!');
      return;
    }

    // Show some examples of broken URLs
    console.log('\nExamples of broken URLs:');
    brokenUrls.slice(0, 5).forEach(result => {
      console.log(`- ${result.url} (${result.status})`);
    });

    // Create new mapping without broken URLs
    const newSeedMap = {};
    const brokenMappings = [];

    for (const [externalUrl, localPath] of Object.entries(seedMap)) {
      const result = results.find(r => r.url === externalUrl);

      if (result && result.is404) {
        brokenMappings.push({ externalUrl, localPath, status: result.status });

        // Try to find a replacement
        const replacementUrl = findReplacementUrl(externalUrl, results) || generatePlaceholderUrl();

        if (replacementUrl && replacementUrl !== externalUrl) {
          newSeedMap[replacementUrl] = localPath;
          console.log(`Replacing ${externalUrl} with ${replacementUrl}`);
        } else {
          console.log(`No replacement found for ${externalUrl}, skipping`);
        }
      } else {
        newSeedMap[externalUrl] = localPath;
      }
    }

    // Save the updated mapping
    fs.writeFileSync(seedMapPath, JSON.stringify(newSeedMap, null, 2));
    console.log(`\nUpdated seed-image-map.json: ${Object.keys(newSeedMap).length} mappings (removed ${brokenMappings.length} broken URLs)`);

    // Generate a report
    const reportPath = path.join(__dirname, '../404-fix-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      totalUrls: results.length,
      brokenUrls: brokenUrls.length,
      fixedUrls: brokenMappings.length,
      remainingUrls: Object.keys(newSeedMap).length,
      brokenMappings: brokenMappings.slice(0, 10), // First 10 for brevity
      results: results
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to ${reportPath}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
