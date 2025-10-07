#!/usr/bin/env node
const { spawn } = require('child_process');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    child.on('error', (error) => {
      log(`Failed to start ${command}: ${error.message}`, 'red');
      reject(error);
    });

    child.on('exit', (code) => {
      resolve(code);
    });
  });
}

async function waitForServer(url, timeout = 30000) {
  const startTime = Date.now();
  log(`⏳ Waiting for server at ${url}...`, 'yellow');

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url, {
        timeout: 2000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TestRunner/1.0)' }
      });

      if (response.ok) {
        log('✅ Server is responsive!', 'green');
        return true;
      } else {
        log(`📡 Server responded with status ${response.status}`, 'yellow');
      }
    } catch (error) {
      // Server not ready yet
      process.stdout.write('.');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(''); // New line after dots
  log('❌ Server failed to respond', 'red');
  return false;
}

async function main() {
  try {
    log('🚀 E-commerce Wishlist Test Runner', 'blue');
    log('='.repeat(40), 'blue');

    // Step 1: Clean up existing processes
    log('🧹 Cleaning up existing servers...', 'yellow');
    try {
      await runCommand('pnpm', ['run', 'stop']);
      log('✅ Cleanup completed', 'green');
    } catch (error) {
      log('⚠️  Cleanup may have failed (normal if no servers running)', 'yellow');
    }

    // Step 2: Start development servers in background
    log('🔄 Starting dev servers...', 'yellow');
    const devProcess = spawn('pnpm', ['run', 'dev'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'], // Suppress stdio to avoid cluttering output
      shell: true,
      detached: true,
    });

    global.__DEV_SERVER_PROCESS__ = devProcess;

    // Give servers time to start
    log('⏳ Waiting for all services to initialize (30s)...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 3: Check if servers are ready
    const serverReady = await waitForServer('http://localhost:3000', 25000);
    if (!serverReady) {
      log('⚠️  Server may not be fully ready, proceeding anyway...', 'yellow');
    }

    await new Promise(resolve => setTimeout(resolve, 3000)); // Extra 3s buffer

    // Step 4: Run the wishlist tests in headless mode to avoid browser issues
    log('🧪 Running wishlist management tests...', 'blue');

    const testResult = await runCommand('npx', [
      'playwright',
      'test',
      'apps/web/tests/wishlist-management.spec.ts',
      '--reporter=line',
      '--timeout=60000',
      '--workers=1'
    ]);

    // Step 5: Cleanup
    log('🧹 Shutting down servers...', 'yellow');
    if (global.__DEV_SERVER_PROCESS__) {
      global.__DEV_SERVER_PROCESS__.kill('SIGKILL');
    }

    log('✅ Wishlist testing completed!', 'green');
    process.exit(testResult);

  } catch (error) {
    log(`❌ Test runner failed: ${error.message}`, 'red');

    // Cleanup on failure
    if (global.__DEV_SERVER_PROCESS__) {
      global.__DEV_SERVER_PROCESS__.kill('SIGKILL');
    }

    process.exit(1);
  }
}

// Handle script interruption
process.on('SIGINT', () => {
  log('\n🛑 Interrupted, cleaning up...', 'yellow');
  if (global.__DEV_SERVER_PROCESS__) {
    global.__DEV_SERVER_PROCESS__.kill('SIGKILL');
  }
  process.exit(130);
});

main();
