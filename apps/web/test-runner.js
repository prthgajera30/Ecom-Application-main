#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

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
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command ${command} exited with code ${code}`));
      }
    });
  });
}

async function waitForServer(url, timeout = 60000) {
  const startTime = Date.now();

  log('Checking if server is ready...', 'yellow');

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        log('✅ Server is ready!', 'green');
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }

    // Wait 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  log('❌ Server failed to start within timeout', 'red');
  return false;
}

async function main() {
  try {
    log('🚀 Starting E-commerce Test Runner', 'blue');
    log('=' .repeat(50), 'blue');

    // Step 1: Clean up existing processes
    log('🧹 Cleaning up existing server processes...', 'yellow');
    try {
      await runCommand('pnpm', ['run', 'stop']);
      log('✅ Server cleanup completed', 'green');
    } catch (error) {
      log('⚠️  Server cleanup failed (may be normal if no servers running)', 'yellow');
    }

    // Step 2: Start development servers
    log('🔄 Starting development servers...', 'yellow');
    const devProcess = spawn('pnpm', ['run', 'dev'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
      detached: true, // Allow it to run independently
    });

    // Store the process so we can kill it later
    global.__DEV_SERVER_PROCESS__ = devProcess;

    // Give servers a moment to start up
    log('⏳ Waiting for servers to initialize...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 3: Wait for web server to be ready
    const webServerReady = await waitForServer('http://localhost:3000', 120000); // 2 minute timeout
    if (!webServerReady) {
      throw new Error('Web server failed to start');
    }

    // Additional wait to ensure Next.js is fully ready
    log('⏳ Ensuring Next.js is fully loaded...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Run the Playwright tests
    log('🧪 Running Playwright tests...', 'blue');

    // Run tests one by one - comment out all except the one you want to test
    const tests = [
      'smoke.spec.ts',
      'auth-guest-flow.spec.ts',
      'auth-registered-flow.spec.ts',
      'auth-mobile.spec.ts',
      'auth-profile.spec.ts',
      'catalog-browse.spec.ts',
      'cart-management.spec.ts',
      'checkout-guest.spec.ts',
      'checkout-registered.spec.ts',
      'home-personalization.spec.ts',
      'mobile-navigation.spec.ts',
      'orders-history.spec.ts',
      'price-filter.spec.ts',
      'product-variants.spec.ts',
      'reviews-system.spec.ts',
      'wishlist-management.spec.ts'
    ];

    // Comment out all tests except the one you want to run
    // Currently testing: checkout-registered.spec.ts
    const testToRun = 'checkout-registered.spec.ts';

    log(`🧪 Running single test: ${testToRun}`, 'blue');
    const exitCode = await runCommand('npx', ['playwright', 'test', testToRun, '--reporter=line', '--timeout=120000'], { cwd: 'apps/web' });

    // Step 5: Cleanup
    log('🧹 Cleaning up servers...', 'yellow');
    devProcess.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1000));
    devProcess.kill('SIGKILL'); // Force kill if needed

    log('✅ Test execution completed!', 'green');
    process.exit(exitCode);

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
  log('\n🛑 Received SIGINT, cleaning up...', 'yellow');
  if (global.__DEV_SERVER_PROCESS__) {
    global.__DEV_SERVER_PROCESS__.kill('SIGKILL');
  }
  process.exit(130);
});

process.on('SIGTERM', () => {
  log('\n🛑 Received SIGTERM, cleaning up...', 'yellow');
  if (global.__DEV_SERVER_PROCESS__) {
    global.__DEV_SERVER_PROCESS__.kill('SIGKILL');
  }
  process.exit(143);
});

main();
