import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// From tools/scripts/core/ -> go up three levels to reach project root
const ROOT_DIR = path.resolve(__dirname, '../../..');

// --- Configuration ---
// Simplified: only 'default' (local dev) and 'docker' modes
const CONFIG = {
  default: {
    envFile: '.env',
    rpcUrl: 'http://127.0.0.1:9545'
  },
  docker: {
    envFile: '.env.docker',
    rpcUrl: 'http://127.0.0.1:8545' // Host access to docker
  }
};

// --- Helpers ---

function run(command, args, options = {}) {
  const cmdString = `${command} ${args.join(' ')}`;
  console.log(`\n> ${cmdString}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd: ROOT_DIR, // Always run from project root
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}: ${cmdString}`));
    });
  });
}

function runBackground(command, args, color, name, env = {}) {
  console.log(`\n> [BG] ${name}: ${command} ${args.join(' ')}`);
  return spawn(command, args, {
    stdio: 'pipe',
    shell: true,
    cwd: ROOT_DIR,
    env: { ...process.env, FORCE_COLOR: '1', ...env }
  });
}

async function waitForRpc(url, retries = 30) {
  console.log(`⏳ Waiting for RPC at ${url}...`);
  const check = () => new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => res.statusCode === 200 ? resolve() : reject());
    req.on('error', reject);
    req.write(JSON.stringify({ jsonrpc: '2.0', method: 'web3_clientVersion', params: [], id: 1 }));
    req.end();
  });

  for (let i = 0; i < retries; i++) {
    try {
      await check();
      console.log('RPC is ready!');
      return;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('RPC timed out');
}

async function waitForSnap(url = 'http://localhost:8080', retries = 30) {
  console.log(`⏳ Waiting for Snap server at ${url}...`);
  const check = () => new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      method: 'GET',
      path: '/',
      timeout: 2000
    }, (res) => {
      // Any response means the server is up
      resolve();
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });

  for (let i = 0; i < retries; i++) {
    try {
      await check();
      console.log('Snap server is ready!');
      return;
    } catch (e) {
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  console.warn('Snap server may not be ready yet. MetaMask will retry when installing the snap.');
}

function syncEnv(mode, isTest = false) {
  const target = CONFIG[mode].envFile;
  console.log(`\n[Env] Switching to ${mode} (${target})`);

  // Determine SNAP_ID based on mode
  // default mode (pnpm dev) -> npm package (production-like)
  // local/docker mode -> local snap server
  const snapId = (mode === 'default')
    ? 'npm:@circuloos/snap'
    : 'local:http://localhost:8080';

  // Sync root .env file from template
  // All services now use the root .env and .env.docker files
  const rootEnvSrc = path.join(ROOT_DIR, target);
  const rootEnvDst = path.join(ROOT_DIR, '.env');

  if (fs.existsSync(rootEnvSrc)) {
    let content = fs.readFileSync(rootEnvSrc, 'utf8');

    // Preserve existing DIAMOND_ADDRESS if present
    if (fs.existsSync(rootEnvDst)) {
      const existingContent = fs.readFileSync(rootEnvDst, 'utf8');
      const diamondMatch = existingContent.match(/^(DIAMOND_ADDRESS|NEXT_PUBLIC_DIAMOND_ADDRESS)=(.+)$/m);
      if (diamondMatch && diamondMatch[2]) {
        const envVarName = diamondMatch[1];
        const diamondAddress = diamondMatch[2];
        const emptyPattern = new RegExp(`^${envVarName}=\\s*$`, 'm');
        if (emptyPattern.test(content)) {
          content = content.replace(emptyPattern, `${envVarName}=${diamondAddress}`);
          console.log(`   Preserved ${envVarName}=${diamondAddress}`);
        }
      }
    }

    fs.writeFileSync(rootEnvDst, content);
    console.log(`   Updated .env from ${target}`);
  }

  // Also update frontend .env for NEXT_PUBLIC_* variables (needed for Next.js build)
  const frontendEnvSrc = path.join(ROOT_DIR, `apps/web/${target}`);
  const frontendEnvDst = path.join(ROOT_DIR, 'apps/web/.env');
  if (fs.existsSync(frontendEnvSrc)) {
    fs.copyFileSync(frontendEnvSrc, frontendEnvDst);
    console.log(`   Updated frontend/.env`);
  }

}


function loadFrontendEnv() {
  // Load frontend/.env into process.env so docker-compose can verify build args
  const frontendEnvPath = path.join(ROOT_DIR, 'apps/web/.env');
  if (fs.existsSync(frontendEnvPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(frontendEnvPath));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
    console.log('   Loaded frontend/.env into host environment');
  }
}

/**
 * Write Diamond config to Docker shared volume
 * This propagates the deployed Diamond address to all services via shared volume
 */
async function propagateDiamondConfig(diamondAddress, dockerComposePath) {
  if (!diamondAddress) {
    console.warn('No Diamond address to propagate');
    return;
  }

  const config = {
    diamondAddress,
    deployedAt: new Date().toISOString(),
    networkName: 'hardhat',
    chainId: 31337
  };

  const configJson = JSON.stringify(config, null, 2);

  console.log(`\nPropagating Diamond address to shared volume: ${diamondAddress}`);

  try {
    // Write config to hardhat container (which has the shared-config volume mounted)
    // Use echo with heredoc to write multi-line JSON
    await run('docker', [
      'exec', 'alastria-hardhat',
      'sh', '-c',
      `mkdir -p /shared && echo '${configJson}' > /shared/diamond-config.json`
    ]);
    console.log('Diamond config written to shared volume');
  } catch (error) {
    console.warn('Could not write to shared volume:', error.message);
    // Fallback: try to write via bind mount
    try {
      const sharedDir = path.join(ROOT_DIR, 'data/shared');
      if (!fs.existsSync(sharedDir)) {
        fs.mkdirSync(sharedDir, { recursive: true });
      }
      fs.writeFileSync(path.join(sharedDir, 'diamond-config.json'), configJson);
      console.log('Diamond config written to data/shared (fallback)');
    } catch (fallbackError) {
      console.warn('Fallback also failed:', fallbackError.message);
    }
  }
}

/**
 * Read Diamond address from deployed checkpoint files
 */
function readDeployedDiamondAddress() {
  const checkpointFiles = [
    path.join(ROOT_DIR, '.checkpoint.docker.json'),
    path.join(ROOT_DIR, '.checkpoint.local.json'),
    path.join(ROOT_DIR, '.env'),
  ];

  for (const filePath of checkpointFiles) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (filePath.endsWith('.json')) {
          const checkpoint = JSON.parse(content);
          if (checkpoint.diamondAddress) {
            console.log(`   Found Diamond address in ${path.basename(filePath)}: ${checkpoint.diamondAddress}`);
            return checkpoint.diamondAddress;
          }
        } else if (filePath.endsWith('.env')) {
          const match = content.match(/^DIAMOND_ADDRESS=(.+)$/m);
          if (match && match[1]) {
            console.log(`   Found Diamond address in ${path.basename(filePath)}: ${match[1]}`);
            return match[1];
          }
        }
      }
    } catch (error) {
      // Ignore and try next file
    }
  }

  return null;
}

// --- Main Logic ---

async function main() {
  const args = process.argv.slice(2);
  const isDocker = args.includes('--docker');
  const isDefault = !isDocker;
  const isInit = args.includes('--init');
  const isTest = args.includes('--test'); // Email testing mode (Mailpit)

  // Extract service name if --service flag is present
  const serviceIndex = args.indexOf('--service');
  const serviceName = serviceIndex !== -1 && args[serviceIndex + 1]
    ? args[serviceIndex + 1]
    : null;

  // Determine mode: 'docker' or 'default'
  const mode = isDocker ? 'docker' : 'default';

  try {
    // 1. Setup Environment
    syncEnv(mode, isTest);

    // Load frontend env for docker build args
    loadFrontendEnv();

    if (isDocker) {
      // --- DOCKER FLOW ---
      console.log('\nStarting Docker Environment...');

      // Build TypeScript packages before Docker build to ensure latest compiled code
      console.log('\nBuilding TypeScript packages...');
      try {
        // Build common package (dependency of all others)
        console.log('   Building @circuloos/common...');
        await run('pnpm', ['--filter', './libs/common', 'build'], { cwd: ROOT_DIR });

        // Build file-store package
        console.log('   Building @circuloos/file-store...');
        await run('pnpm', ['--filter', './libs/file-store', 'build'], { cwd: ROOT_DIR });

        // Build backend services
        console.log('   Building @circuloos/issuer...');
        await run('pnpm', ['--filter', './apps/issuer', 'build'], { cwd: ROOT_DIR });

        console.log('   Building @circuloos/verifier...');
        await run('pnpm', ['--filter', './apps/verifier', 'build'], { cwd: ROOT_DIR });

        console.log('TypeScript packages built successfully!\n');
      } catch (buildError) {
        console.error('Error building TypeScript packages:', buildError.message);
        console.error('   Docker build will continue, but may use stale compiled code.');
        console.error('   If you see issues, rebuild manually: pnpm --filter "./packages/common" build\n');
      }

      // Docker compose path (used throughout docker flow)
      const dockerComposePath = path.join(ROOT_DIR, 'docker-compose.yml');

      // If a specific service is requested, ensure dependencies are up first
      if (serviceName) {
        const serviceMap = {
          'frontend': 'web',
          'issuer': 'issuer',
          'verifier': 'verifier'
        };

        const dockerServiceName = serviceMap[serviceName.toLowerCase()];
        if (!dockerServiceName) {
          console.error(`Unknown service: ${serviceName}`);
          console.error('Available services: frontend, issuer, verifier');
          process.exit(1);
        }

        // Always ensure hardhat is running first
        console.log('Ensuring Hardhat is running...');
        await run('docker', ['compose', '-f', dockerComposePath, 'up', '-d', 'hardhat']);
        await waitForRpc(CONFIG.docker.rpcUrl);

        // If issuer or verifier, ensure they have dependencies
        if (dockerServiceName === 'issuer' || dockerServiceName === 'verifier') {
          // Build TypeScript packages before Docker build
          console.log('\nBuilding TypeScript packages...');
          try {
            console.log('   Building @circuloos/common...');
            await run('pnpm', ['--filter', './libs/common', 'build'], { cwd: ROOT_DIR });
            console.log('   Building @circuloos/file-store...');
            await run('pnpm', ['--filter', './libs/file-store', 'build'], { cwd: ROOT_DIR });
            if (dockerServiceName === 'issuer') {
              console.log('   Building @circuloos/issuer...');
              await run('pnpm', ['--filter', './apps/issuer', 'build'], { cwd: ROOT_DIR });
            } else if (dockerServiceName === 'verifier') {
              console.log('   Building @circuloos/verifier...');
              await run('pnpm', ['--filter', './apps/verifier', 'build'], { cwd: ROOT_DIR });
            }
            console.log('TypeScript packages built!\n');
            console.log(' TypeScript packages built!\n');
          } catch (buildError) {
            console.warn('  Build warning:', buildError.message);
            console.warn('   Continuing with Docker build...\n');
          }

          console.log(` Starting ${serviceName} service...`);
          await run('docker', ['compose', '-f', dockerComposePath, 'up', '-d', '--build', dockerServiceName]);
        } else if (dockerServiceName === 'web') {
          // Frontend needs issuer and verifier
          // Build backend packages first
          console.log('\n Building backend packages...');
          try {
            console.log('   Building @circuloos/common...');
            await run('pnpm', ['--filter', './libs/common', 'build'], { cwd: ROOT_DIR });
            console.log('   Building @circuloos/file-store...');
            await run('pnpm', ['--filter', './libs/file-store', 'build'], { cwd: ROOT_DIR });
            console.log('   Building @circuloos/issuer...');
            await run('pnpm', ['--filter', './apps/issuer', 'build'], { cwd: ROOT_DIR });
            console.log('   Building @circuloos/verifier...');
            await run('pnpm', ['--filter', './apps/verifier', 'build'], { cwd: ROOT_DIR });
            console.log(' Backend packages built!\n');
          } catch (buildError) {
            console.warn('  Build warning:', buildError.message);
            console.warn('   Continuing with Docker build...\n');
          }

          console.log(' Ensuring backend services are running...');
          await run('docker', ['compose', '-f', dockerComposePath, 'up', '-d', '--build', 'issuer', 'verifier']);
          console.log(' Starting frontend...');
          await run('docker', ['compose', '-f', dockerComposePath, 'up', '-d', '--build', 'web']);
        }

        console.log(`\n ${serviceName} service running!`);
        console.log(`\nPress Ctrl+C to stop.\n`);

        // Follow logs for this service
        const logProc = spawn('docker', ['compose', '-f', dockerComposePath, 'logs', '-f', dockerServiceName], {
          stdio: 'inherit',
          shell: true,
          cwd: ROOT_DIR
        });

        const cleanup = () => {
          console.log('\n\n Shutting down...');
          logProc.kill();
          process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        // Wait for log process
        await new Promise((resolve) => {
          logProc.on('close', resolve);
        });

        return;
      }

      // Full docker setup (all services)
      // --build forces image rebuild with latest code (no cache reuse)
      const composeArgs = ['compose', '-f', dockerComposePath];

      // If --test flag is present, include email-testing profile to start Mailpit
      // --profile must come before the command (up)
      if (isTest) {
        composeArgs.push('--profile', 'email-testing');
        console.log('\n Email Testing Mode: Mailpit will be started');
        console.log('   Web UI: http://localhost:8025');
        console.log('   SMTP: localhost:1025\n');
      }

      composeArgs.push('up', '-d', '--build');
      await run('docker', composeArgs);

      await waitForRpc(CONFIG.docker.rpcUrl);

      if (isInit) {
        // Note: In Docker mode, the deployer container already ran deploy:docker:init
        // The shared config was written to /shared/diamond-config.json by the deployer
        // We just need to read the deployed address and sync env files

        console.log('\n Reading deployed Diamond address from shared config...');

        // Try to read diamond address from Docker shared volume first
        let diamondAddress = null;
        try {
          const result = await new Promise((resolve, reject) => {
            const child = spawn('docker', ['exec', 'alastria-hardhat', 'cat', '/shared/diamond-config.json'], {
              stdio: ['pipe', 'pipe', 'pipe'],
              shell: true,
              cwd: ROOT_DIR
            });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (data) => { stdout += data.toString(); });
            child.stderr.on('data', (data) => { stderr += data.toString(); });
            child.on('close', (code) => {
              if (code === 0) resolve(stdout);
              else reject(new Error(stderr || `Exit code ${code}`));
            });
          });
          const config = JSON.parse(result);
          diamondAddress = config.diamondAddress;
          console.log(`   Found Diamond address in shared config: ${diamondAddress}`);
        } catch (error) {
          console.log('   Could not read from shared config, trying checkpoint files...');
          diamondAddress = readDeployedDiamondAddress();
        }

        if (diamondAddress) {
          // Update .env files with diamond address
          const envPath = path.join(ROOT_DIR, '.env');
          if (fs.existsSync(envPath)) {
            let content = fs.readFileSync(envPath, 'utf8');
            const diamondRegex = /^DIAMOND_ADDRESS=.*$/m;
            if (diamondRegex.test(content)) {
              content = content.replace(diamondRegex, `DIAMOND_ADDRESS=${diamondAddress}`);
            } else {
              content = `DIAMOND_ADDRESS=${diamondAddress}\n${content}`;
            }
            fs.writeFileSync(envPath, content);
            console.log(`   Updated .env with DIAMOND_ADDRESS=${diamondAddress}`);
          }

          // Also propagate to shared volume if needed
          await propagateDiamondConfig(diamondAddress, dockerComposePath);
        }

        // Re-sync envs
        syncEnv(mode, isTest);
        loadFrontendEnv();

        console.log('\n Docker Environment Initialized & Ready!');
        console.log(`   Diamond Address: ${diamondAddress || 'Not found'}`);
      }

      // Start MetaMask Snap in background for docker mode
      // The snap needs to be running at localhost:8080 for docker mode
      console.log('\n Starting MetaMask Snap (localhost:8080)...');
      const snapProc = runBackground('pnpm', ['--filter', './apps/snap', 'start'], 'magenta', 'SNAP');

      // Pipe snap output with prefix
      snapProc.stdout.on('data', (data) => {
        process.stdout.write(`[SNAP] ${data}`);
      });
      snapProc.stderr.on('data', (data) => {
        process.stderr.write(`[SNAP] ${data}`);
      });

      // Wait for snap server to be ready
      try {
        await waitForSnap('http://localhost:8080', 30);
      } catch (error) {
        console.warn('  Snap server may take longer to start. If installation fails, wait a few seconds and try again.');
      }

      console.log('\n All services running!');
      console.log(' Frontend: http://localhost:3000');
      console.log(' Issuer: http://localhost:3001');
      console.log(' Verifier: http://localhost:4001');
      console.log('  Hardhat: http://localhost:8545');
      console.log(' Snap: http://localhost:8080');
      if (isTest) {
        console.log(' Mailpit (Email Testing): http://localhost:8025');
      }
      console.log('\nPress Ctrl+C to stop all services.\n');

      // Keep process alive and handle cleanup
      const cleanup = () => {
        console.log('\n\n Shutting down...');
        snapProc.kill();
        run('docker', ['compose', '-f', dockerComposePath, 'down']).then(() => process.exit(0));
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      // Wait indefinitely
      await new Promise(() => { });

    } else {
      // --- LOCAL FLOW ---
      if (isTest) {
        console.warn('\n  Warning: --test flag only works in Docker mode (--docker)');
        console.warn('   Mailpit requires Docker. Use "pnpm dev:docker:init:test" instead.\n');
      }

      const modeLabel = mode === 'local' ? 'Local' : 'Default';
      console.log(`\n Starting ${modeLabel} Environment (${CONFIG[mode].envFile}, Connecting to External Chain at 9545)...`);

      await waitForRpc(CONFIG.local.rpcUrl);

      if (isInit) {
        console.log('\n Deploying Contracts (Init)...');
        await run('pnpm', ['--filter', './apps/contracts', 'deploy:local:init']);
        syncEnv(mode, isTest);
      }

      // Start MetaMask Snap in background for local/local modes
      // The snap needs to be running at localhost:8080 for these modes
      console.log('\n Starting MetaMask Snap (localhost:8080)...');
      const snapProc = runBackground('pnpm', ['--filter', './apps/snap', 'start'], 'magenta', 'SNAP');

      // Pipe snap output with prefix
      snapProc.stdout.on('data', (data) => {
        process.stdout.write(`[SNAP] ${data}`);
      });
      snapProc.stderr.on('data', (data) => {
        process.stderr.write(`[SNAP] ${data}`);
      });

      // Wait for snap server to be ready
      try {
        await waitForSnap('http://localhost:8080', 30);
      } catch (error) {
        console.warn('  Snap server may take longer to start. If installation fails, wait a few seconds and try again.');
      }

      // Determine which dev command to use based on mode
      const devCmd = mode === 'local' ? 'dev:local' : 'dev';

      // If a specific service is requested, start only that one
      if (serviceName) {
        console.log(`\n Starting ${serviceName} service only...`);

        let filterName;
        let serviceLabel;

        switch (serviceName.toLowerCase()) {
          case 'frontend':
            filterName = 'apps/web';
            serviceLabel = 'FRONTEND';
            break;
          case 'issuer':
            filterName = '@circuloos/issuer';
            serviceLabel = 'ISSUER';
            break;
          case 'verifier':
            filterName = '@circuloos/verifier';
            serviceLabel = 'VERIFIER';
            break;
          default:
            console.error(` Unknown service: ${serviceName}`);
            console.error('Available services: frontend, issuer, verifier');
            process.exit(1);
        }

        await run('pnpm', ['--filter', filterName, devCmd]);
      } else {
        // Setup cleanup for snap when running all services
        const cleanup = () => {
          console.log('\n\n Shutting down...');
          snapProc.kill();
          process.exit(0);
        };
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        // Start all services in parallel
        console.log('\n Starting All Services...');
        await run('concurrently', [
          '-k',
          '-n', '"FRONTEND,ISSUER,VERIFIER"',
          '-c', '"green,cyan,yellow"',
          `"pnpm --filter apps/web ${devCmd}"`,
          `"pnpm --filter @circuloos/issuer ${devCmd}"`,
          `"pnpm --filter @circuloos/verifier ${devCmd}"`
        ]);
      }
    }

  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

main();
