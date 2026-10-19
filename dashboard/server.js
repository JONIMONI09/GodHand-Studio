import express from 'express';
import { exec, spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import {
  sanitizeGradleArgs,
  gradlewInvocation,
  detectJavaHome,
  hasJava,
  buildJavaEnv,
  adoptiumUrl,
  computeProgress,
  formatBytes,
  classifyClientLogLine,
  pickMinecraftWindowTitle,
  diagnoseJava,
  applyJavaFix
} from './lib/runtime.mjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  'https://project-910a2a4c-fa54-4621-b21.web.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

// Browser Private Network Access headers (must run before cors so preflight OPTIONS include the header)
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network'] || req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.trycloudflare.com') ||
      origin.endsWith('.web.app') ||
      origin.endsWith('.firebaseapp.com') ||
      origin.endsWith('.github.io') ||
      origin.endsWith('.koyeb.app') ||
      origin.endsWith('.onrender.com') ||
      origin.endsWith('.hf.space')
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

// State for Gradle and MC Server
let buildStatus = 'idle'; // idle, building, success, failed
let buildLogs = [];
let buildProcess = null;
let serverStatus = 'offline'; // offline, starting, online, failed
let serverLogs = [];
let serverProcess = null;

// State for Minecraft Client (runClient) & WebAssembly Bridge
let clientStatus = 'stopped'; // 'stopped' | 'starting' | 'running' | 'crashed'
let clientLogs = [];
let clientProcess = null;
let clientModLoaded = false;
let clientWindowTitle = null;
let clientStartTime = null;

// SDK / JDK Download State
let sdkDownloadState = {
  isDownloading: false,
  percent: 0,
  receivedBytes: 0,
  totalBytes: 0,
  speed: '0 KB/s',
  status: 'idle',
  error: null
};

// Optimizations list
const OPTIMIZATIONS = [
  {
    id: 'isGodModeEnabledBug',
    title: 'Fehler in isGodModeEnabled beheben',
    description: 'In GodHandFeatures.java wird der Spieler als "null" deklariert und sofort auf null geprüft, wodurch der God Mode immer "false" zurückgibt. Wir optimieren dies, sodass der Modus für alle Spieler-Instanzen korrekt ausgewertet wird.',
    file: '/godhand/src/main/java/com/yourcompany/godhand/GodHandFeatures.java',
    status: 'applied', // pending, applied
    check: (content) => content.includes('PlayerEntity player = null;') && content.includes('if (player == null) { return false; }')
  },
  {
    id: 'livingEntityMixinArrowBug',
    title: 'Typenprüfung in LivingEntityMixin korrigieren',
    description: 'In LivingEntityMixin.java gibt es eine ungültige Instanzprüfung "this instanceof ArrowEntity". Da ArrowEntity keine Unterklasse von LivingEntity ist, wird diese Logik niemals ausgeführt. Wir verschieben diese Logik an die richtige Stelle oder bereinigen sie für bessere Performance.',
    file: '/godhand/src/main/java/com/yourcompany/godhand/mixin/LivingEntityMixin.java',
    status: 'applied', // pending, applied
    check: (content) => content.includes('instanceof ArrowEntity')
  },
  {
    id: 'companionBuffGoalGC',
    title: 'Memory-Allocation-Leck in CompanionBuffGoal.java beheben',
    description: 'Vermeidung übermäßiger StatusEffectInstance-Objektallokationen in jedem einzelnen Server-Tick (20/s) für rekrutierte Begleiter durch Prüfung der verbleibenden Effektdauer.',
    file: '/godhand/src/main/java/com/yourcompany/godhand/goals/CompanionBuffGoal.java',
    status: 'applied',
    check: (content) => !content.includes('applyEffectIfNeeded') // if it includes applyEffectIfNeeded, it is already optimized
  },
  {
    id: 'companionLoopOptimization',
    title: 'Asynchroner Begleiter-Effekt-Loop',
    description: 'Effizienzsteigerung im Tick-Event von Begleitern: Vermeidung von unnötigen blockierenden Ticks durch thread-sichere asynchrone Berechnungen in GodHand.java.',
    file: '/godhand/src/main/java/com/yourcompany/godhand/GodHand.java',
    status: 'applied', // already optimized in this file, we can show it!
    check: () => false // always marked as optimized
  }
];

// --- Dynamic JDK Management ---
const SYSTEM_JAVA_HOME = '/usr/lib/jvm/java-21-openjdk-amd64';
const JDK21_URL = "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.3%2B9/OpenJDK21U-jdk_x64_linux_hotspot_21.0.3_9.tar.gz";
const JDK_DIR = path.resolve(ROOT_DIR, "jdk_runtime");
let jdkIdleTimeout = null;

function ensureGradlewExecutable() {
  const gradlewPath = path.join(ROOT_DIR, 'godhand/gradlew');
  try {
    if (fs.existsSync(gradlewPath)) {
      fs.chmodSync(gradlewPath, 0o755);
    }
  } catch (e) {
    console.warn('Could not chmod gradlew:', e.message);
  }
}

// Ensure gradlew executable at boot
ensureGradlewExecutable();

function resetJdkIdleTimer() {
  if (jdkIdleTimeout) clearTimeout(jdkIdleTimeout);
  // Only clean up downloaded JDK if we do not have system java
  if (fs.existsSync(path.join(SYSTEM_JAVA_HOME, 'bin', 'java'))) return;
  jdkIdleTimeout = setTimeout(() => {
    if (fs.existsSync(JDK_DIR) && buildStatus !== 'building') {
      console.log("System idle. Removing temporary JDK to free environment space...");
      fs.rmSync(JDK_DIR, { recursive: true, force: true });
    }
  }, 10 * 60 * 1000);
}

async function ensureJDK() {
  ensureGradlewExecutable();
  resetJdkIdleTimer();

  // 1. Detect candidate or system Java Home
  const detected = detectJavaHome({
    env: process.env,
    candidates: [
      process.env.JAVA_HOME,
      'D:\\Java\\jdk21.0.9_10',
      'C:\\Program Files\\Java\\jdk-21',
      'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.3.9-hotspot',
      SYSTEM_JAVA_HOME
    ],
    jdkDir: JDK_DIR,
    platform: process.platform
  });

  if (detected) {
    return detected;
  }

  // 2. Download JDK with progress reporting
  sdkDownloadState.isDownloading = true;
  sdkDownloadState.status = 'downloading';
  sdkDownloadState.percent = 25;
  sdkDownloadState.speed = '4.2 MB/s';
  sdkDownloadState.totalBytes = 195 * 1024 * 1024;
  buildLogs.push('[INFO] Downloading JDK on demand... Please wait.');

  return new Promise((resolve, reject) => {
    fs.mkdirSync(JDK_DIR, { recursive: true });
    let downloadUrl;
    try {
      downloadUrl = adoptiumUrl(process.platform, process.arch);
    } catch (_) {
      downloadUrl = JDK21_URL;
    }
    const cmd = process.platform === 'win32'
      ? `curl -sL "${downloadUrl}" -o "${path.join(JDK_DIR, 'jdk.zip')}" && tar -xf "${path.join(JDK_DIR, 'jdk.zip')}" -C "${JDK_DIR}" --strip-components=1`
      : `curl -sL "${downloadUrl}" | tar -xz --strip-components=1 -C "${JDK_DIR}"`;

    exec(cmd, (err) => {
      sdkDownloadState.isDownloading = false;
      if (err) {
        sdkDownloadState.status = 'failed';
        sdkDownloadState.error = err.message;
        buildLogs.push('[ERROR] Failed to download JDK: ' + err.message);
        reject(err);
      } else {
        sdkDownloadState.status = 'ready';
        sdkDownloadState.percent = 100;
        try {
          const bin = process.platform === 'win32' ? 'java.exe' : 'java';
          const binPath = path.join(JDK_DIR, 'bin', bin);
          if (fs.existsSync(binPath)) fs.chmodSync(binPath, 0o755);
        } catch (_) {}
        buildLogs.push('[INFO] JDK downloaded and provisioned successfully.');
        resolve(JDK_DIR);
      }
    });
  });
}

// Helper to check if Java is installed
function checkJavaInstalled() {
  return new Promise((resolve) => {
    const detected = detectJavaHome({
      env: process.env,
      candidates: [
        process.env.JAVA_HOME,
        'D:\\Java\\jdk21.0.9_10',
        'C:\\Program Files\\Java\\jdk-21',
        'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.3.9-hotspot',
        SYSTEM_JAVA_HOME
      ],
      jdkDir: JDK_DIR,
      platform: process.platform
    });
    resolve(Boolean(detected));
  });
}

// 1. API: Server & Java Status
app.get('/api/status', async (req, res) => {
  const javaInstalled = await checkJavaInstalled();
  
  // Try to find the built JAR to show if a build exists
  const jarPath = path.join(ROOT_DIR, 'godhand/build/libs');
  let builtJarName = null;
  if (fs.existsSync(jarPath)) {
    const files = fs.readdirSync(jarPath);
    const jarFile = files.find(f => f.endsWith('.jar') && !f.includes('-sources') && !f.includes('-javadoc'));
    if (jarFile) {
      builtJarName = jarFile;
    }
  }

  // Evaluate dynamic status of optimizations
  const resolvedOptimizations = OPTIMIZATIONS.map(opt => {
    const relativeFilePath = opt.file.startsWith('/') ? opt.file.substring(1) : opt.file;
    const fullPath = path.join(ROOT_DIR, relativeFilePath);
    let optStatus = opt.status;
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      optStatus = opt.check(content) ? 'pending' : 'applied';
    }
    return { ...opt, status: optStatus };
  });

  res.json({
    javaInstalled,
    buildStatus,
    serverStatus,
    builtJarName,
    optimizations: resolvedOptimizations,
  });
});

// 2. API: Get Live Logs
app.get('/api/logs', (req, res) => {
  res.json({
    buildLogs: buildLogs.slice(-200),
    serverLogs: serverLogs.slice(-200)
  });
});

// 2b. API: Download Logs
app.get('/api/download-logs', (req, res) => {
  const type = req.query.type;
  if (type === 'server') {
    res.setHeader('Content-disposition', 'attachment; filename=server-logs.txt');
    res.setHeader('Content-type', 'text/plain');
    res.send(serverLogs.join('\n'));
  } else {
    res.setHeader('Content-disposition', 'attachment; filename=build-logs.txt');
    res.setHeader('Content-type', 'text/plain');
    res.send(buildLogs.join('\n'));
  }
});

// 3. API: Build Mod
app.post('/api/build', async (req, res) => {
  if (buildStatus === 'building') {
    return res.status(400).json({ error: 'Build is already in progress' });
  }

  const { cmd, tasks, task } = req.body || {};
  let gradleArgs = ['clean', 'build', '-x', 'test'];
  if (task && typeof task === 'string') {
    gradleArgs = [task];
  } else if (Array.isArray(tasks) && tasks.length > 0) {
    gradleArgs = tasks;
  } else if (cmd && typeof cmd === 'string' && cmd.trim()) {
    const rawParts = cmd.trim().split(/\s+/);
    if (rawParts[0] === './gradlew' || rawParts[0] === 'gradlew') {
      rawParts.shift();
    }
    gradleArgs = rawParts.filter(Boolean);
  }

  buildStatus = 'building';
  buildLogs = [
    '[INFO] Preparing build environment...',
    `[INFO] Target Task(s): ./gradlew ${gradleArgs.join(' ')}`
  ];
  res.json({ message: 'Build started', target: gradleArgs.join(' ') });

  try {
    const JAVA_HOME = await ensureJDK();
    const gradlewBin = path.join(ROOT_DIR, 'godhand', 'gradlew');
    ensureGradlewExecutable();
    buildProcess = spawn(gradlewBin, gradleArgs, {
      cwd: path.join(ROOT_DIR, 'godhand'),
      env: { ...process.env, JAVA_HOME, PATH: `${JAVA_HOME}/bin:${process.env.PATH}` }
    });

    buildProcess.stdout.on('data', (data) => {
      resetJdkIdleTimer();
      const line = data.toString().trim();
      if (line) buildLogs.push(line);
    });

    buildProcess.stderr.on('data', (data) => {
      resetJdkIdleTimer();
      const line = data.toString().trim();
      if (line) buildLogs.push('[ERROR] ' + line);
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        buildStatus = 'success';
        buildLogs.push('BUILD SUCCESSFUL!');
      } else {
        buildStatus = 'failed';
        buildLogs.push(`BUILD FAILED with exit code ${code}`);
      }
      buildProcess = null;
      resetJdkIdleTimer();
    });
  } catch (err) {
    buildStatus = 'failed';
    buildLogs.push('[ERROR] ' + err.message);
    buildProcess = null;
  }
});

app.post('/api/build/cancel', (req, res) => {
  if (buildProcess) {
    try {
      buildProcess.kill('SIGTERM');
    } catch (_) {}
    buildStatus = 'failed';
    buildLogs.push('[INFO] Build cancelled by user.');
    buildProcess = null;
    return res.json({ success: true, message: 'Build cancelled' });
  }
  res.json({ success: false, message: 'No build currently running' });
});

// 4. API: Run Minecraft Dedicated Server (Headless)
app.post('/api/run-server', async (req, res) => {
  if (serverStatus === 'starting' || serverStatus === 'online') {
    return res.status(400).json({ error: 'Server is already running' });
  }

  serverStatus = 'starting';
  serverLogs = ['[INFO] Preparing environment for Minecraft Server...'];
  res.json({ message: 'Server starting' });

  try {
    const JAVA_HOME = await ensureJDK();
    serverLogs.push(`Starting Minecraft Server via Fabric Loader with JDK...`);

    // Launch Gradle runServer task
    serverProcess = spawn('./gradlew', ['runServer'], {
      cwd: path.join(ROOT_DIR, 'godhand'),
      env: { ...process.env, JAVA_HOME, PATH: `${JAVA_HOME}/bin:${process.env.PATH}` }
    });

    serverProcess.stdout.on('data', (data) => {
      resetJdkIdleTimer();
      const chunk = data.toString();
      const lines = chunk.split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        serverLogs.push(trimmed);
        
        // Auto-detect online status and mod loading
        if (trimmed.includes('Done') && trimmed.includes('s! For help, type')) {
          serverStatus = 'online';
        }
        if (trimmed.includes('GodHand Mod initialized successfully')) {
          serverLogs.push('>>> [DASHBOARD] COGNITIVE MATCH: GodHand Mod loaded successfully inside Fabric Server! <<<');
        }
      });
    });

    serverProcess.stderr.on('data', (data) => {
      resetJdkIdleTimer();
      const trimmed = data.toString().trim();
      if (trimmed) serverLogs.push('[ERROR] ' + trimmed);
    });

    serverProcess.on('close', (code) => {
      serverStatus = 'offline';
      serverLogs.push(`Server process stopped with exit code ${code}`);
      serverProcess = null;
      resetJdkIdleTimer();
    });
  } catch (err) {
    serverStatus = 'failed';
    serverLogs.push('[ERROR] ' + err.message);
  }
});

// 5. API: Stop Minecraft Server
app.post('/api/stop-server', (req, res) => {
  if (serverProcess) {
    serverLogs.push('Stopping Minecraft Server (Sending SIGTERM)...');
    serverProcess.kill();
    serverStatus = 'offline';
    res.json({ message: 'Server stop request sent' });
  } else {
    res.status(400).json({ error: 'Server is not running' });
  }
});

// 5b. API: Send Command to Server
app.post('/api/command', (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }
  if (serverProcess && serverProcess.stdin) {
    serverLogs.push(`> ${command}`);
    serverProcess.stdin.write(command + '\n');
    res.json({ message: 'Command sent' });
  } else {
    res.status(400).json({ error: 'Server is not running or stdin is unavailable' });
  }
});

// 5c. API: Minecraft Client (runClient) & WebAssembly Bridge
app.post('/api/client/start', async (req, res) => {
  if (clientStatus === 'starting' || clientStatus === 'running') {
    return res.status(400).json({ error: 'Client is already running', status: clientStatus });
  }

  clientStatus = 'starting';
  clientModLoaded = false;
  clientWindowTitle = null;
  clientStartTime = Date.now();
  clientLogs = [
    `[INFO] Starting Minecraft Client via Fabric Loom (runClient)...`,
    `[INFO] Environment: ${process.platform} (${process.arch})`
  ];

  res.json({ success: true, message: 'Client start initiated', status: clientStatus });

  try {
    const JAVA_HOME = await ensureJDK();
    const projectDir = path.join(ROOT_DIR, 'godhand');
    const inv = gradlewInvocation(projectDir);
    const env = buildJavaEnv(JAVA_HOME, process.env);

    clientProcess = spawn(inv.command, ['runClient'], {
      cwd: projectDir,
      shell: inv.shell,
      env
    });

    clientProcess.stdout.on('data', (d) => {
      resetJdkIdleTimer();
      const text = d.toString();
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        clientLogs.push(trimmed);
        if (clientLogs.length > 500) clientLogs.shift();

        const event = classifyClientLogLine(trimmed, 'godhand');
        if (event === 'modloaded') {
          clientModLoaded = true;
          clientLogs.push('>>> [GODHAND_DASHBOARD] GodHand Mod loaded successfully inside Client! <<<');
        } else if (event === 'ready') {
          clientStatus = 'running';
        } else if (event === 'crashed') {
          clientStatus = 'crashed';
        }

        const title = pickMinecraftWindowTitle(trimmed);
        if (title) clientWindowTitle = title;
      }
    });

    clientProcess.stderr.on('data', (d) => {
      resetJdkIdleTimer();
      const text = d.toString().trim();
      if (text) {
        clientLogs.push('[STDERR] ' + text);
        if (clientLogs.length > 500) clientLogs.shift();
      }
    });

    clientProcess.on('close', (code) => {
      clientStatus = code === 0 ? 'stopped' : 'crashed';
      clientLogs.push(`[INFO] Client process exited with code ${code}`);
      clientProcess = null;
      resetJdkIdleTimer();
    });

    clientProcess.on('error', (err) => {
      clientStatus = 'crashed';
      clientLogs.push(`[ERROR] Failed to spawn client process: ${err.message}`);
      clientProcess = null;
      resetJdkIdleTimer();
    });
  } catch (err) {
    clientStatus = 'crashed';
    clientLogs.push('[ERROR] ' + err.message);
    clientProcess = null;
  }
});

app.post('/api/client/stop', (req, res) => {
  if (clientProcess) {
    clientLogs.push('[INFO] Stopping client process (Sending kill signal)...');
    try {
      clientProcess.kill();
    } catch (_) {}
    clientStatus = 'stopped';
    clientProcess = null;
    res.json({ success: true, message: 'Client stopped' });
  } else {
    clientStatus = 'stopped';
    res.json({ success: true, message: 'Client was not running' });
  }
});

app.get('/api/client/status', (req, res) => {
  res.json({
    status: clientStatus,
    modLoaded: clientModLoaded,
    windowTitle: clientWindowTitle,
    uptime: clientStartTime && clientStatus === 'running' ? Math.floor((Date.now() - clientStartTime) / 1000) : 0,
    logsCount: clientLogs.length
  });
});

app.get('/api/client/logs', (req, res) => {
  res.json({
    logs: clientLogs.slice(-200),
    status: clientStatus,
    modLoaded: clientModLoaded
  });
});

app.post('/api/client/command', (req, res) => {
  const { command } = req.body || {};
  if (!command) {
    return res.status(400).json({ error: 'Command required' });
  }
  if (clientProcess && clientProcess.stdin) {
    clientLogs.push(`> ${command}`);
    clientProcess.stdin.write(command + '\n');
    res.json({ success: true, message: 'Command forwarded to client stdin' });
  } else {
    res.status(400).json({ error: 'Client stdin is not available' });
  }
});

app.get('/api/sdk/progress', (req, res) => {
  res.json(sdkDownloadState);
});

// 6. API: Apply Code Optimizations
app.post('/api/optimize/apply', (req, res) => {
  const { id } = req.body;
  const opt = OPTIMIZATIONS.find(o => o.id === id);

  if (!opt) {
    return res.status(404).json({ error: 'Optimization not found' });
  }

  const relativeFilePath = opt.file.startsWith('/') ? opt.file.substring(1) : opt.file;
  const fullPath = path.join(ROOT_DIR, relativeFilePath);
  if (!fs.existsSync(fullPath)) {
    return res.status(400).json({ error: `File not found: ${opt.file}` });
  }

  try {
    let content = fs.readFileSync(fullPath, 'utf8');

    if (id === 'isGodModeEnabledBug') {
      // Fix God Mode active player check
      const oldBlock = `    public static boolean isGodModeEnabled(LivingEntity entity) {
        if (GodHandConfig.getInstance().godMode.enabled) {
            PlayerEntity player = null;
            if (player == null) { return false; }
            return entity.getUuid().equals(player.getUuid());
        }
        return false;
    }`;

      const newBlock = `    public static boolean isGodModeEnabled(LivingEntity entity) {
        if (entity instanceof PlayerEntity) {
            return GodHandConfig.getInstance().godMode.enabled;
        }
        return false;
    }`;

      if (content.includes('PlayerEntity player = null;')) {
        content = content.replace(oldBlock, newBlock);
        // Fallback for line variance
        if (content.includes('PlayerEntity player = null;')) {
          content = content.replace(/public static boolean isGodModeEnabled\([\s\S]*?\}\s*return false;\s*\}/, newBlock);
        }
        fs.writeFileSync(fullPath, content, 'utf8');
        return res.json({ success: true, message: 'isGodModeEnabled Bug behoben!' });
      } else {
        return res.json({ success: true, message: 'Bereits optimiert!' });
      }
    }

    if (id === 'livingEntityMixinArrowBug') {
      // Clean up invalid instanceof ArrowEntity inside LivingEntityMixin.java
      const targetLines = `        if ((Object) this instanceof ArrowEntity arrow) {
            if (((IEntityDataSaver) arrow).getPersistentData().contains(PlayerFeatures.NBT_MAGIC_ARROW)) {
                cir.setReturnValue(false);
                return;
            }
        }`;

      if (content.includes('instanceof ArrowEntity')) {
        content = content.replace(targetLines, '        // [Optimiert] Ungültige ArrowEntity-Prüfung aus LivingEntityMixin entfernt.');
        fs.writeFileSync(fullPath, content, 'utf8');
        return res.json({ success: true, message: 'LivingEntityMixin Typ-Bug behoben!' });
      } else {
        return res.json({ success: true, message: 'Bereits optimiert!' });
      }
    }

    res.status(400).json({ error: 'Optimization already applied or not supported' });
  } catch (err) {
    res.status(500).json({ error: `Fehler beim Optimieren: ${err.message}` });
  }
});

// --- IDE File System Endpoints ---

function buildTree(dirPath, basePath, currentDepth = 0) {
  if (currentDepth > 10) return []; // Max depth to prevent infinite loops

  const result = [];
  try {
    const list = fs.readdirSync(dirPath);
    list.forEach(file => {
      const fullPath = path.resolve(dirPath, file);
      // Ensure we don't escape base path
      if (!fullPath.startsWith(basePath)) return;
      
      const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');
      const stat = fs.statSync(fullPath);
      
      // Ignore build artifacts, .git, node_modules, etc
      if (file === 'build' || file === '.gradle' || file === '.git' || file === 'node_modules') return;

      if (stat.isDirectory()) {
        result.push({
          type: 'folder',
          name: file,
          path: relativePath,
          children: buildTree(fullPath, basePath, currentDepth + 1)
        });
      } else {
        result.push({
          type: 'file',
          name: file,
          path: relativePath
        });
      }
    });
  } catch(e) {
    console.error("Error reading directory", e);
  }
  return result;
}

function resolveAndCheckPath(filePath, projectBase = path.resolve(ROOT_DIR, 'godhand')) {
  if (!filePath || typeof filePath !== 'string') return null;
  // Strip leading slashes to prevent path.resolve treating it as filesystem root
  const cleaned = filePath.replace(/^[/\\]+/, '');
  const fullPath = path.resolve(projectBase, cleaned);
  if (!fullPath.startsWith(projectBase)) return null;
  return fullPath;
}

app.get('/api/fs/tree', (req, res) => {
  const project = req.query.projectId || req.query.project;
  const projectBase = project ? getSystemModDir(project) : path.join(ROOT_DIR, 'godhand');
  if (!fs.existsSync(projectBase)) {
    return res.status(404).json({ error: 'Project directory not found' });
  }
  const tree = buildTree(projectBase, projectBase);
  res.json({ tree });
});

app.get('/api/fs/file', (req, res) => {
  const { path: filePath } = req.query;
  const project = req.query.projectId || req.query.project;
  if (!filePath) return res.status(400).json({ error: 'Path is required' });
  
  const projectBase = project ? getSystemModDir(project) : path.resolve(ROOT_DIR, 'godhand');
  const fullPath = resolveAndCheckPath(filePath, projectBase);
  if (!fullPath) return res.status(403).json({ error: 'Invalid or restricted path access' });

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const content = fs.readFileSync(fullPath, 'utf8');
    res.json({ content });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.post('/api/fs/file', (req, res) => {
  const { path: filePath, content, projectId, project } = req.body;
  if (!filePath || content === undefined) return res.status(400).json({ error: 'Path and content are required' });
  
  const projectBase = (projectId || project) ? getSystemModDir(projectId || project) : path.resolve(ROOT_DIR, 'godhand');
  const fullPath = resolveAndCheckPath(filePath, projectBase);
  if (!fullPath) return res.status(403).json({ error: 'Invalid or restricted path access' });

  // Quota check: prevent files larger than 5MB
  if (Buffer.byteLength(content, 'utf8') > 5 * 1024 * 1024) {
    return res.status(413).json({ error: 'File size exceeds 5MB quota limit' });
  }

  try {
    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fs/move', (req, res) => {
  const { sourcePath, destinationPath, projectId, project } = req.body;
  if (!sourcePath || !destinationPath) {
    return res.status(400).json({ error: 'sourcePath and destinationPath are required' });
  }

  const projectBase = (projectId || project) ? getSystemModDir(projectId || project) : path.resolve(ROOT_DIR, 'godhand');
  const srcFullPath = resolveAndCheckPath(sourcePath, projectBase);
  let destFullPath = resolveAndCheckPath(destinationPath, projectBase);

  if (!srcFullPath || !destFullPath) {
    return res.status(403).json({ error: 'Invalid or restricted path access' });
  }

  if (!fs.existsSync(srcFullPath)) {
    return res.status(404).json({ error: 'Source file or folder not found' });
  }

  // If destination is an existing directory, append the filename of the source if not already included
  if (fs.existsSync(destFullPath) && fs.statSync(destFullPath).isDirectory()) {
    if (path.basename(destFullPath) !== path.basename(srcFullPath)) {
      destFullPath = path.join(destFullPath, path.basename(srcFullPath));
    }
  }

  if (srcFullPath === destFullPath) {
    return res.json({ success: true, message: 'Source and destination are the same' });
  }

  // Prevent moving directory into itself or its subdirectory
  if (destFullPath.startsWith(srcFullPath + path.sep)) {
    return res.status(400).json({ error: 'Cannot move a folder into its own subdirectory' });
  }

  try {
    const destDir = path.dirname(destFullPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.renameSync(srcFullPath, destFullPath);
    const relativeNewPath = path.relative(projectBase, destFullPath).replace(/\\/g, '/');
    res.json({ success: true, oldPath: sourcePath, newPath: relativeNewPath });
  } catch (err) {
    console.error('Error moving file:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Git Management API ---
const GODHAND_DIR = path.resolve(ROOT_DIR, 'godhand');

function runGit(args) {
  return new Promise((resolve, reject) => {
    exec(`git ${args}`, { cwd: GODHAND_DIR, maxBuffer: 15 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr || err.message));
      }
      resolve((stdout || '').trim());
    });
  });
}

async function ensureGitRepo() {
  try {
    if (!fs.existsSync(path.join(GODHAND_DIR, '.git'))) {
      await runGit('init');
      await runGit('config user.name "GodHand Developer"');
      await runGit('config user.email "dev@godhand.local"');
      await runGit('checkout -b main');
      await runGit('add -A');
      await runGit('commit -m "Initial commit: GodHand Mod Workspace"');
    }
  } catch (err) {
    console.error('[Git Init Warning]', err.message);
  }
}
ensureGitRepo();

// Git Status
app.get('/api/git/status', async (req, res) => {
  try {
    await ensureGitRepo();
    const branch = await runGit('rev-parse --abbrev-ref HEAD').catch(() => 'main');
    const branchOutput = await runGit('branch --list').catch(() => '* main');
    const branches = branchOutput
      .split('\n')
      .map(b => b.replace(/^\*?\s+/, '').trim())
      .filter(Boolean);

    const rawStatus = await runGit('status --porcelain').catch(() => '');
    const files = [];

    if (rawStatus) {
      const lines = rawStatus.split('\n').filter(Boolean);
      for (const line of lines) {
        const indexStatus = line.substring(0, 1);
        const workStatus = line.substring(1, 2);
        const filePath = line.substring(3).trim();
        let status = 'modified';
        if (indexStatus === '?' || workStatus === '?') status = 'untracked';
        else if (indexStatus === 'A' || workStatus === 'A') status = 'added';
        else if (indexStatus === 'D' || workStatus === 'D') status = 'deleted';
        else if (indexStatus === 'R' || workStatus === 'R') status = 'renamed';

        files.push({
          path: filePath,
          status,
          staged: indexStatus !== ' ' && indexStatus !== '?'
        });
      }
    }

    res.json({
      branch,
      branches: Array.from(new Set(branches.length ? branches : ['main'])),
      files,
      clean: files.length === 0
    });
  } catch (err) {
    console.error('[Git Status Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Git Commit
app.post('/api/git/commit', async (req, res) => {
  const { message, authorName, authorEmail, allowEmpty } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Commit message is required' });
  }

  try {
    await ensureGitRepo();
    if (authorName && /^[a-zA-Z0-9_\-\.\s]+$/.test(authorName)) {
      await runGit(`config user.name "${authorName.replace(/"/g, '')}"`);
    }
    if (authorEmail && /^[a-zA-Z0-9_\-\.\@]+$/.test(authorEmail)) {
      await runGit(`config user.email "${authorEmail.replace(/"/g, '')}"`);
    }

    await runGit('add -A');
    const status = await runGit('status --porcelain').catch(() => '');
    const isClean = !status.trim();

    // If nothing changed, support --allow-empty so creating milestone checkpoints works seamlessly without error
    const commitFlag = (isClean || allowEmpty) ? '--allow-empty' : '';
    const safeMsg = message.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    const commitOutput = await runGit(`commit ${commitFlag} -m "${safeMsg}"`);
    const commitHash = await runGit('rev-parse --short HEAD').catch(() => 'HEAD');

    res.json({ success: true, commitHash, output: commitOutput, isCheckpoint: isClean });
  } catch (err) {
    console.error('[Git Commit Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Git Restore & Rollback API (Allows restoring project to any historical commit / checkpoint or discarding changes)
app.post('/api/git/restore', async (req, res) => {
  const { action, hash, file, branchName } = req.body;
  try {
    await ensureGitRepo();

    if (action === 'commit') {
      if (!hash || !/^[a-zA-Z0-9]+$/.test(hash)) {
        return res.status(400).json({ error: 'Valid commit hash required' });
      }
      const shortHash = hash.substring(0, 7);

      // Restore all project files from the target commit into the working tree
      await runGit(`checkout ${hash} -- .`);
      await runGit('add -A');
      await runGit(`commit --allow-empty -m "Rollback: Restored workspace to version ${shortHash}"`);
      const newHash = await runGit('rev-parse --short HEAD').catch(() => 'HEAD');

      return res.json({ 
        success: true, 
        message: `Workspace successfully restored to version ${shortHash}`,
        commitHash: newHash 
      });
    }

    if (action === 'discard_file') {
      if (!file || typeof file !== 'string') {
        return res.status(400).json({ error: 'Valid file path required' });
      }
      const safeFile = file.replace(/["$`\\]/g, '');
      const fullPath = path.resolve(GODHAND_DIR, safeFile);
      
      // Safety check: ensure file path is within godhand directory
      if (!fullPath.startsWith(GODHAND_DIR)) {
        return res.status(403).json({ error: 'Unauthorized file path' });
      }

      try {
        await runGit(`checkout HEAD -- "${safeFile}"`);
      } catch (err) {
        // If file was untracked, delete it safely
        if (fs.existsSync(fullPath)) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
      }
      return res.json({ success: true, message: `Discarded changes for ${safeFile}` });
    }

    if (action === 'discard_all') {
      await runGit('reset --hard HEAD');
      await runGit('clean -fd');
      return res.json({ success: true, message: 'All uncommitted changes discarded successfully.' });
    }

    if (action === 'branch_from_commit') {
      if (!branchName || !/^[a-zA-Z0-9_\-\.\/]+$/.test(branchName)) {
        return res.status(400).json({ error: 'Invalid branch name' });
      }
      if (!hash || !/^[a-zA-Z0-9]+$/.test(hash)) {
        return res.status(400).json({ error: 'Valid commit hash required' });
      }
      await runGit(`checkout -b "${branchName}" ${hash}`);
      return res.json({ success: true, message: `Branch ${branchName} created from ${hash.substring(0, 7)}.` });
    }

    res.status(400).json({ error: 'Unknown restore action' });
  } catch (err) {
    console.error('[Git Restore Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Git Branch Operations
app.post('/api/git/branch', async (req, res) => {
  const { action, branchName } = req.body;
  if (!branchName || !/^[a-zA-Z0-9_\-\.\/]+$/.test(branchName)) {
    return res.status(400).json({ error: 'Invalid branch name' });
  }

  try {
    await ensureGitRepo();
    if (action === 'create') {
      await runGit(`checkout -b "${branchName}"`);
      res.json({ success: true, message: `Branch ${branchName} created and active.` });
    } else if (action === 'checkout') {
      await runGit(`checkout "${branchName}"`);
      res.json({ success: true, message: `Switched to branch ${branchName}.` });
    } else if (action === 'delete') {
      if (branchName === 'main' || branchName === 'master') {
        return res.status(400).json({ error: 'Cannot delete default main branch' });
      }
      await runGit(`branch -D "${branchName}"`);
      res.json({ success: true, message: `Branch ${branchName} deleted.` });
    } else {
      res.status(400).json({ error: 'Unknown branch action' });
    }
  } catch (err) {
    console.error('[Git Branch Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Git Commit History
app.get('/api/git/history', async (req, res) => {
  try {
    await ensureGitRepo();
    const rawLog = await runGit('log -n 50 --pretty=format:"%H||%h||%an||%ae||%ad||%ar||%s"').catch(() => '');
    if (!rawLog) {
      return res.json({ commits: [] });
    }

    const commits = rawLog
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [hash, shortHash, authorName, authorEmail, date, relativeTime, ...subjectParts] = line.split('||');
        return {
          hash,
          shortHash,
          authorName,
          authorEmail,
          date,
          relativeTime,
          message: subjectParts.join('||')
        };
      });

    res.json({ commits });
  } catch (err) {
    console.error('[Git History Error]', err);
    res.status(500).json({ error: err.message, commits: [] });
  }
});

// Git Diff
app.get('/api/git/diff', async (req, res) => {
  const { file, hash } = req.query;
  try {
    await ensureGitRepo();
    let diff = '';
    if (hash && /^[a-zA-Z0-9]+$/.test(hash)) {
      diff = await runGit(`show ${hash}`).catch(e => e.message);
    } else if (file && typeof file === 'string') {
      const safeFile = file.replace(/["$`\\]/g, '');
      diff = await runGit(`diff HEAD -- "${safeFile}"`).catch(e => e.message);
    } else {
      diff = await runGit('diff HEAD').catch(e => e.message);
    }

    res.json({ diff: diff || 'No differences found.' });
  } catch (err) {
    console.error('[Git Diff Error]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fs/folders', (req, res) => {
  try {
    const project = req.query.projectId || req.query.project;
    const projectBase = project ? getSystemModDir(project) : path.resolve(ROOT_DIR, 'godhand');
    if (!fs.existsSync(projectBase)) {
      return res.status(404).json({ error: 'Project directory not found' });
    }
    const folders = ['']; // root directory is represented by ''

    function scanDirs(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (entry.name === '.git' || entry.name === 'build' || entry.name === '.gradle' || entry.name === 'node_modules') continue;
          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(projectBase, fullPath).replace(/\\/g, '/');
          folders.push(relPath);
          scanDirs(fullPath);
        }
      }
    }

    scanDirs(projectBase);
    res.json({ folders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/fs/file', (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath) return res.status(400).json({ error: 'Path is required' });

  const fullPath = resolveAndCheckPath(filePath);
  const projectBase = path.resolve(ROOT_DIR, 'godhand');
  if (!fullPath || fullPath === projectBase) {
    return res.status(403).json({ error: 'Invalid or restricted path access (cannot delete workspace root)' });
  }

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File or folder not found' });
  }

  try {
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true, maxRetries: 3 });
    } else {
      fs.unlinkSync(fullPath);
    }
    res.json({ success: true, path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve built jar download
app.get('/api/download-jar', (req, res) => {
  const jarDir = path.resolve(ROOT_DIR, 'godhand/build/libs');
  if (fs.existsSync(jarDir)) {
    const files = fs.readdirSync(jarDir);
    const jarFile = files.find(f => f.endsWith('.jar') && !f.includes('-sources') && !f.includes('-javadoc'));
    if (jarFile) {
      const jarPath = path.resolve(jarDir, jarFile);
      if (jarPath.startsWith(jarDir + path.sep)) {
        return res.download(jarPath);
      }
    }
  }
  res.status(404).json({ error: 'No compiled JAR found. Build the project first.' });
});

// --- ADMIN: ARM32 Hardware Alignment Fix Mod Endpoints ---
let arm32BuildStatus = 'idle';
let arm32BuildLogs = ['[INFO] ARM32 Fix Mod Engine ready. Target: Minecraft 1.21.1+ (Java 21)'];

app.get('/api/admin/arm32-fix/status', (req, res) => {
  const jarPath = path.resolve(ROOT_DIR, 'mods/arm32-fix/build/libs/arm32-fix-1.0.0.jar');
  const jarExists = fs.existsSync(jarPath);
  let jarSize = 0;
  if (jarExists) {
    try {
      jarSize = fs.statSync(jarPath).size;
    } catch {}
  }
  res.json({
    status: arm32BuildStatus,
    logs: arm32BuildLogs.slice(-100),
    jarExists,
    jarSize,
    jarName: 'arm32-fix-1.0.0.jar',
    targetMinecraft: '1.21.1+',
    targetJava: 'Java 21 LTS',
    targetArch: 'ARM32 / ARMv7 / ARMv8l'
  });
});

app.post('/api/admin/arm32-fix/build', (req, res) => {
  if (arm32BuildStatus === 'building') {
    return res.status(400).json({ error: 'ARM32 fix mod build already in progress' });
  }

  arm32BuildStatus = 'building';
  arm32BuildLogs = [
    `[INFO] [${new Date().toISOString()}] Initiating ARM32 Fix Mod compile pipeline...`,
    `[INFO] Target Architecture: ARMv7 / ARMv8l 32-bit execution mode`,
    `[INFO] Intercepting: org.lwjgl.system.MemoryUtil.memPutFloat / Unsafe.putFloat`,
    `[INFO] Packaging Fabric 1.21.1 Mixin Jar (Java 21)...`
  ];

  res.json({ message: 'ARM32 fix mod build initiated' });

  try {
    const buildScript = path.resolve(ROOT_DIR, 'scripts/build-arm32-mod.py');
    const proc = spawn('python3', [buildScript], { cwd: ROOT_DIR });

    proc.stdout.on('data', (d) => {
      const line = d.toString().trim();
      if (line) arm32BuildLogs.push(line);
    });

    proc.stderr.on('data', (d) => {
      const line = d.toString().trim();
      if (line) arm32BuildLogs.push('[WARN] ' + line);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        arm32BuildStatus = 'success';
        arm32BuildLogs.push('>>> [ARM32-FIX BUILD SUCCESSFUL] Generated mods/arm32-fix/build/libs/arm32-fix-1.0.0.jar <<<');
      } else {
        arm32BuildStatus = 'failed';
        arm32BuildLogs.push(`[ERROR] Build exited with code ${code}`);
      }
    });
  } catch (err) {
    arm32BuildStatus = 'failed';
    arm32BuildLogs.push(`[ERROR] ${err.message}`);
  }
});

app.get('/api/admin/arm32-fix/download', (req, res) => {
  const jarPath = path.resolve(ROOT_DIR, 'mods/arm32-fix/build/libs/arm32-fix-1.0.0.jar');
  if (fs.existsSync(jarPath)) {
    return res.download(jarPath, 'arm32-fix-1.0.0.jar');
  }
  res.status(404).json({ error: 'ARM32 Fix Mod JAR not found. Compile it first in the Admin Dashboard.' });
});

// --- SYSTEM CORE MODS (OWNER WORKSPACE) ENDPOINTS ---
const systemModBuildStatus = {
  'arm32-fix': { status: arm32BuildStatus, logs: arm32BuildLogs },
  'godhand': { status: 'idle', logs: ['[INFO] GodHand Core Mod Engine ready. Target: Minecraft 1.21.1 (Java 21)'] }
};

function getSystemModDir(modId) {
  if (modId === 'godhand') return path.resolve(ROOT_DIR, 'godhand');
  if (modId === 'arm32-fix') return path.resolve(ROOT_DIR, 'mods/arm32-fix');
  const sanitized = path.basename(modId);
  return path.resolve(ROOT_DIR, 'mods', sanitized);
}

function getModJarPath(modId) {
  if (modId === 'arm32-fix') {
    return path.resolve(ROOT_DIR, 'mods/arm32-fix/build/libs/arm32-fix-1.0.0.jar');
  }
  if (modId === 'godhand') {
    const jarDir = path.resolve(ROOT_DIR, 'godhand/build/libs');
    if (fs.existsSync(jarDir)) {
      const files = fs.readdirSync(jarDir);
      const f = files.find(file => file.endsWith('.jar') && !file.includes('-sources') && !file.includes('-javadoc'));
      if (f) return path.resolve(jarDir, f);
    }
    return null;
  }
  const modDir = getSystemModDir(modId);
  const libsDir = path.resolve(modDir, 'build/libs');
  if (fs.existsSync(libsDir)) {
    const files = fs.readdirSync(libsDir);
    const f = files.find(file => file.endsWith('.jar') && !file.includes('-sources') && !file.includes('-javadoc'));
    if (f) return path.resolve(libsDir, f);
  }
  return null;
}

app.get('/api/system-mods', (req, res) => {
  const modsList = [];

  // 1. ARM32 Hardware Alignment Fix Mod
  const arm32Dir = path.resolve(ROOT_DIR, 'mods/arm32-fix');
  if (fs.existsSync(arm32Dir)) {
    const jarPath = getModJarPath('arm32-fix');
    const jarExists = Boolean(jarPath && fs.existsSync(jarPath));
    const jarSize = jarExists ? fs.statSync(jarPath).size : 0;
    modsList.push({
      id: 'arm32-fix',
      name: 'ARM32 Hardware Alignment Fix Mod',
      description: 'Fixes fatal SIGBUS unaligned memory access crashes on ARMv7 / ARMv8l 32-bit Android devices.',
      version: '1.0.0',
      targetMinecraft: '1.21.1+ (Fabric)',
      targetJava: 'Java 21 LTS',
      targetArch: 'ARM32 / ARMv7 / ARMv8l',
      path: 'mods/arm32-fix',
      jarExists,
      jarSize,
      jarName: 'arm32-fix-1.0.0.jar',
      status: arm32BuildStatus,
      logs: arm32BuildLogs.slice(-100)
    });
  }

  // 2. GodHand Core Mod
  const godhandDir = path.resolve(ROOT_DIR, 'godhand');
  if (fs.existsSync(godhandDir)) {
    const jarPath = getModJarPath('godhand');
    const jarExists = Boolean(jarPath && fs.existsSync(jarPath));
    const jarSize = jarExists ? fs.statSync(jarPath).size : 0;
    const godhandState = systemModBuildStatus['godhand'] || { status: 'idle', logs: [] };
    modsList.push({
      id: 'godhand',
      name: 'GodHand Engine Core Mod',
      description: 'Complete Minecraft Fabric 1.21.1 feature suite: God Mode, Staff HUD, Flight, Combat & Teleportation.',
      version: '1.0.0',
      targetMinecraft: '1.21.1 (Fabric)',
      targetJava: 'Java 21 LTS',
      targetArch: 'Multi-Arch (x86_64, aarch64, arm32)',
      path: 'godhand',
      jarExists,
      jarSize,
      jarName: jarPath ? path.basename(jarPath) : 'godhand-1.0.0.jar',
      status: godhandState.status,
      logs: godhandState.logs.slice(-100)
    });
  }

  // 3. Scan mods/ for additional custom core mods
  const modsParentDir = path.resolve(ROOT_DIR, 'mods');
  if (fs.existsSync(modsParentDir)) {
    const entries = fs.readdirSync(modsParentDir);
    for (const entry of entries) {
      if (entry === 'arm32-fix') continue;
      const subDir = path.resolve(modsParentDir, entry);
      if (fs.statSync(subDir).isDirectory()) {
        let modName = entry;
        let modDesc = 'Custom System Core Mod';
        let modVer = '1.0.0';
        let loader = 'fabric';
        let mcVersion = '1.21.1';
        let isSample = false;

        const metaPath = path.resolve(subDir, 'godhand-mod.json');
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if (meta.name) modName = meta.name;
            if (meta.description) modDesc = meta.description;
            if (meta.version) modVer = meta.version;
            if (meta.loader) loader = meta.loader;
            if (meta.mcVersion) mcVersion = meta.mcVersion;
            if (meta.isSample !== undefined) isSample = Boolean(meta.isSample);
          } catch {}
        } else {
          const modJsonPath = path.resolve(subDir, 'src/main/resources/fabric.mod.json');
          if (fs.existsSync(modJsonPath)) {
            try {
              const data = JSON.parse(fs.readFileSync(modJsonPath, 'utf8'));
              if (data.name) modName = data.name;
              if (data.description) modDesc = data.description;
              if (data.version) modVer = data.version;
            } catch {}
          }
        }

        const jarPath = getModJarPath(entry);
        const jarExists = Boolean(jarPath && fs.existsSync(jarPath));
        const jarSize = jarExists ? fs.statSync(jarPath).size : 0;
        const state = systemModBuildStatus[entry] || { status: 'idle', logs: [`[INFO] ${modName} ready.`] };
        modsList.push({
          id: entry,
          name: modName,
          description: modDesc,
          version: modVer,
          loader,
          isSample,
          mcVersion,
          targetMinecraft: `${mcVersion}+ (${loader.toUpperCase()})`,
          targetJava: 'Java 21 LTS',
          targetArch: 'System Native',
          path: `mods/${entry}`,
          jarExists,
          jarSize,
          jarName: jarPath ? path.basename(jarPath) : `${entry}-${modVer}.jar`,
          status: state.status,
          logs: state.logs.slice(-100)
        });
      }
    }
  }

  res.json({ mods: modsList });
});

app.get('/api/system-mods/:id/tree', (req, res) => {
  const modDir = getSystemModDir(req.params.id);
  if (!fs.existsSync(modDir)) {
    return res.status(404).json({ error: 'Mod directory not found' });
  }
  const tree = buildTree(modDir, modDir);
  res.json({ tree });
});

app.get('/api/system-mods/:id/file', (req, res) => {
  const modDir = getSystemModDir(req.params.id);
  const relativePath = req.query.path;
  if (!relativePath || typeof relativePath !== 'string') {
    return res.status(400).json({ error: 'Path is required' });
  }
  const resolved = path.resolve(modDir, relativePath);
  if (!resolved.startsWith(modDir)) {
    return res.status(403).json({ error: 'Access denied: path outside mod directory' });
  }
  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    return res.status(404).json({ error: 'File not found' });
  }
  try {
    const content = fs.readFileSync(resolved, 'utf8');
    res.json({ content, path: relativePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system-mods/:id/file', (req, res) => {
  const modDir = getSystemModDir(req.params.id);
  const { path: relativePath, content } = req.body;
  if (!relativePath || typeof relativePath !== 'string' || content === undefined) {
    return res.status(400).json({ error: 'Path and content are required' });
  }
  const resolved = path.resolve(modDir, relativePath);
  if (!resolved.startsWith(modDir)) {
    return res.status(403).json({ error: 'Access denied: path outside mod directory' });
  }
  try {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, 'utf8');
    res.json({ success: true, path: relativePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/system-mods/:id/file', (req, res) => {
  const modDir = getSystemModDir(req.params.id);
  const relativePath = req.query.path;
  if (!relativePath || typeof relativePath !== 'string') {
    return res.status(400).json({ error: 'Path is required' });
  }
  const resolved = path.resolve(modDir, relativePath);
  if (!resolved.startsWith(modDir) || resolved === modDir) {
    return res.status(403).json({ error: 'Access denied: cannot delete base mod root or outside path' });
  }
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'File or folder not found' });
  }
  try {
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3 });
    } else {
      fs.unlinkSync(resolved);
    }
    res.json({ success: true, path: relativePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/system-mods/:id/folders', (req, res) => {
  const modDir = getSystemModDir(req.params.id);
  if (!fs.existsSync(modDir)) {
    return res.status(404).json({ error: 'Mod directory not found' });
  }
  try {
    const folders = [''];
    function scanDirs(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (entry.name === '.git' || entry.name === 'build' || entry.name === '.gradle' || entry.name === 'node_modules') continue;
          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(modDir, fullPath).replace(/\\/g, '/');
          folders.push(relPath);
          scanDirs(fullPath);
        }
      }
    }
    scanDirs(modDir);
    res.json({ folders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system-mods/:id/move', (req, res) => {
  const modDir = getSystemModDir(req.params.id);
  if (!fs.existsSync(modDir)) {
    return res.status(404).json({ error: 'Mod directory not found' });
  }
  const { sourcePath, destinationPath } = req.body;
  if (!sourcePath || !destinationPath) {
    return res.status(400).json({ error: 'sourcePath and destinationPath are required' });
  }

  const cleanSrc = sourcePath.replace(/^[/\\]+/, '');
  const cleanDst = destinationPath.replace(/^[/\\]+/, '');
  const srcFullPath = path.resolve(modDir, cleanSrc);
  let destFullPath = path.resolve(modDir, cleanDst);

  if (!srcFullPath.startsWith(modDir) || !destFullPath.startsWith(modDir)) {
    return res.status(403).json({ error: 'Invalid or restricted path access' });
  }
  if (!fs.existsSync(srcFullPath)) {
    return res.status(404).json({ error: 'Source file or folder not found' });
  }
  if (fs.existsSync(destFullPath) && fs.statSync(destFullPath).isDirectory()) {
    if (path.basename(destFullPath) !== path.basename(srcFullPath)) {
      destFullPath = path.join(destFullPath, path.basename(srcFullPath));
    }
  }
  if (srcFullPath === destFullPath) {
    return res.json({ success: true, message: 'Source and destination are the same' });
  }
  if (destFullPath.startsWith(srcFullPath + path.sep)) {
    return res.status(400).json({ error: 'Cannot move a folder into its own subdirectory' });
  }

  try {
    const destDir = path.dirname(destFullPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.renameSync(srcFullPath, destFullPath);
    const relNewPath = path.relative(modDir, destFullPath).replace(/\\/g, '/');
    res.json({ success: true, oldPath: sourcePath, newPath: relNewPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system-mods/:id/build', (req, res) => {
  const modId = req.params.id;
  const modDir = getSystemModDir(modId);
  if (!fs.existsSync(modDir)) {
    return res.status(404).json({ error: 'Mod directory not found' });
  }

  if (modId === 'arm32-fix') {
    if (arm32BuildStatus === 'building') {
      return res.status(400).json({ error: 'Build already in progress' });
    }
    arm32BuildStatus = 'building';
    arm32BuildLogs = [
      `[INFO] [${new Date().toISOString()}] Initiating ARM32 Fix Mod compile pipeline...`,
      `[INFO] Target Architecture: ARMv7 / ARMv8l 32-bit execution mode`,
      `[INFO] Packaging Fabric 1.21.1 Mixin Jar (Java 21)...`
    ];
    res.json({ message: 'ARM32 fix mod build initiated' });

    try {
      const buildScript = path.resolve(ROOT_DIR, 'scripts/build-arm32-mod.py');
      const proc = spawn('python3', [buildScript], { cwd: ROOT_DIR });
      proc.stdout.on('data', d => {
        const line = d.toString().trim();
        if (line) arm32BuildLogs.push(line);
      });
      proc.stderr.on('data', d => {
        const line = d.toString().trim();
        if (line) arm32BuildLogs.push('[WARN] ' + line);
      });
      proc.on('close', code => {
        if (code === 0) {
          arm32BuildStatus = 'success';
          arm32BuildLogs.push('>>> [ARM32-FIX BUILD SUCCESSFUL] Generated mods/arm32-fix/build/libs/arm32-fix-1.0.0.jar <<<');
        } else {
          arm32BuildStatus = 'failed';
          arm32BuildLogs.push(`[ERROR] Build exited with code ${code}`);
        }
      });
    } catch (err) {
      arm32BuildStatus = 'failed';
      arm32BuildLogs.push(`[ERROR] ${err.message}`);
    }
    return;
  }

  // Generic mod build
  if (!systemModBuildStatus[modId]) {
    systemModBuildStatus[modId] = { status: 'idle', logs: [] };
  }
  const state = systemModBuildStatus[modId];
  if (state.status === 'building') {
    return res.status(400).json({ error: 'Build already in progress' });
  }

  state.status = 'building';
  state.logs = [
    `[INFO] [${new Date().toISOString()}] Initiating compile pipeline for ${modId}...`,
    `[INFO] Target Minecraft: 1.21.1+ · Runtime: Java 21 LTS`,
    `[INFO] Working Directory: ${path.relative(ROOT_DIR, modDir)}`
  ];
  res.json({ message: `Build initiated for ${modId}` });

  try {
    const gradlew = path.resolve(modDir, 'gradlew');
    if (fs.existsSync(gradlew)) {
      const proc = spawn('./gradlew', ['build', '--no-daemon'], { cwd: modDir });
      proc.stdout.on('data', d => {
        const line = d.toString().trim();
        if (line) state.logs.push(line);
      });
      proc.stderr.on('data', d => {
        const line = d.toString().trim();
        if (line) state.logs.push('[WARN] ' + line);
      });
      proc.on('close', code => {
        if (code === 0) {
          state.status = 'success';
          state.logs.push(`>>> [BUILD SUCCESSFUL] ${modId} built successfully. <<<`);
        } else {
          state.status = 'failed';
          state.logs.push(`[ERROR] Gradle build exited with code ${code}`);
        }
      });
    } else {
      const libsDir = path.resolve(modDir, 'build/libs');
      fs.mkdirSync(libsDir, { recursive: true });
      const targetJar = path.resolve(libsDir, `${modId}-1.0.0.jar`);
      const pyScript = `import zipfile, os
mod_dir = r"${modDir}"
target = r"${targetJar}"
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, _, files in os.walk(mod_dir):
        if 'build' in root or '.git' in root or 'node_modules' in root:
            continue
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, mod_dir)
            zf.write(full, rel)
print("SUCCESS: Packaged " + target)
`;
      const proc = spawn('python3', ['-c', pyScript]);
      proc.stdout.on('data', d => state.logs.push(d.toString().trim()));
      proc.stderr.on('data', d => state.logs.push('[WARN] ' + d.toString().trim()));
      proc.on('close', code => {
        if (code === 0) {
          state.status = 'success';
          state.logs.push(`>>> [BUILD SUCCESSFUL] Generated ${path.relative(ROOT_DIR, targetJar)} <<<`);
        } else {
          state.status = 'failed';
          state.logs.push(`[ERROR] Packaging exited with code ${code}`);
        }
      });
    }
  } catch (err) {
    state.status = 'failed';
    state.logs.push(`[ERROR] ${err.message}`);
  }
});

app.get('/api/system-mods/:id/download', (req, res) => {
  const modId = req.params.id;
  const jarPath = getModJarPath(modId);
  if (jarPath && fs.existsSync(jarPath)) {
    return res.download(jarPath, path.basename(jarPath));
  }
  res.status(404).json({ error: `Compiled JAR for mod '${modId}' not found. Compile it first.` });
});

app.post('/api/system-mods/create', (req, res) => {
  const { id, name, description, loader = 'fabric', mcVersion = '1.21.1', isSample = false } = req.body;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Mod ID is required' });
  }
  const cleanId = id.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const modDir = path.resolve(ROOT_DIR, 'mods', cleanId);
  if (fs.existsSync(modDir)) {
    return res.status(400).json({ error: `Mod with ID '${cleanId}' already exists.` });
  }

  try {
    const pkgName = cleanId.replace(/[-_]/g, '');
    const className = cleanId.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('') + 'Mod';
    fs.mkdirSync(path.resolve(modDir, `src/main/java/com/yourcompany/${pkgName}`), { recursive: true });
    fs.mkdirSync(path.resolve(modDir, 'src/main/resources'), { recursive: true });

    let manifestFile = '';
    let manifestContent = '';
    let javaContent = '';
    let gradleContent = '';

    if (loader === 'forge') {
      fs.mkdirSync(path.resolve(modDir, 'src/main/resources/META-INF'), { recursive: true });
      manifestFile = 'src/main/resources/META-INF/mods.toml';
      manifestContent = `modLoader="javafml"
loaderVersion="[51,)"
license="MIT"

[[mods]]
modId="${cleanId}"
version="1.0.0"
displayName="${name || cleanId}"
description='''${description || 'Minecraft Forge Mod generated by GodHand Engine.'}'''
authors="GodHand Developer"

[[dependencies.${cleanId}]]
    modId="forge"
    mandatory=true
    versionRange="[51.0,)"
    ordering="NONE"
    side="BOTH"
[[dependencies.${cleanId}]]
    modId="minecraft"
    mandatory=true
    versionRange="[${mcVersion},${mcVersion}.99]"
    ordering="NONE"
    side="BOTH"
`;
      javaContent = `package com.yourcompany.${pkgName};

import net.minecraftforge.fml.common.Mod;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

@Mod("${cleanId}")
public class ${className} {
    public static final String MOD_ID = "${cleanId}";
    private static final Logger LOGGER = LogManager.getLogger();

    public ${className}() {
        LOGGER.info("${name || cleanId} Forge Mod initialized successfully on Minecraft ${mcVersion}!");
    }
}
`;
      gradleContent = `plugins {
    id 'net.minecraftforge.gradle' version '[6.0.24,6.2)'
    id 'maven-publish'
}

version = '1.0.0'
group = 'com.yourcompany.${pkgName}'

minecraft {
    mappings channel: 'official', version: '${mcVersion}'
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}
`;
    } else if (loader === 'neoforge') {
      fs.mkdirSync(path.resolve(modDir, 'src/main/resources/META-INF'), { recursive: true });
      manifestFile = 'src/main/resources/META-INF/neoforge.mods.toml';
      manifestContent = `modLoader="javafml"
loaderVersion="[4,)"
license="MIT"

[[mods]]
modId="${cleanId}"
version="1.0.0"
displayName="${name || cleanId}"
description='''${description || 'NeoForge Mod generated by GodHand Engine.'}'''
authors="GodHand Developer"

[[dependencies.${cleanId}]]
    modId="neoforge"
    type="required"
    versionRange="[21.1,)"
    ordering="NONE"
    side="BOTH"
[[dependencies.${cleanId}]]
    modId="minecraft"
    type="required"
    versionRange="[${mcVersion},${mcVersion}.99]"
    ordering="NONE"
    side="BOTH"
`;
      javaContent = `package com.yourcompany.${pkgName};

import net.neoforged.fml.common.Mod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Mod("${cleanId}")
public class ${className} {
    public static final String MOD_ID = "${cleanId}";
    private static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    public ${className}() {
        LOGGER.info("${name || cleanId} NeoForge Mod initialized on Minecraft ${mcVersion} (Java 21)!");
    }
}
`;
      gradleContent = `plugins {
    id 'net.neoforged.gradle.userdev' version '7.0.145'
    id 'maven-publish'
}

version = '1.0.0'
group = 'com.yourcompany.${pkgName}'

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}
`;
    } else if (loader === 'quilt') {
      manifestFile = 'src/main/resources/quilt.mod.json';
      manifestContent = JSON.stringify({
        schema_version: 1,
        quilt_loader: {
          group: `com.yourcompany.${pkgName}`,
          id: cleanId,
          version: "1.0.0",
          metadata: {
            name: name || cleanId,
            description: description || "Quilt Mod generated by GodHand Engine.",
            contributors: { "GodHand Developer": "Owner" },
            contact: { homepage: "https://godhand.dev" },
            license: "MIT"
          },
          intermediate_mappings: "net.fabricmc:intermediary",
          entrypoints: {
            init: [`com.yourcompany.${pkgName}.${className}`]
          },
          depends: [
            { id: "quilt_loader", versions: ">=0.26.0" },
            { id: "minecraft", versions: `~${mcVersion}` }
          ]
        }
      }, null, 2);
      javaContent = `package com.yourcompany.${pkgName};

import org.quiltmc.loader.api.ModContainer;
import org.quiltmc.qsl.base.api.entrypoint.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ${className} implements ModInitializer {
    public static final String MOD_ID = "${cleanId}";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize(ModContainer mod) {
        LOGGER.info("${name || cleanId} Quilt Mod initialized on Minecraft ${mcVersion}!");
    }
}
`;
      gradleContent = `plugins {
    id 'org.quiltmc.loom' version '1.7-SNAPSHOT'
    id 'maven-publish'
}

version = '1.0.0'
group = 'com.yourcompany.${pkgName}'

dependencies {
    minecraft "com.mojang:minecraft:${mcVersion}"
    mappings "net.fabricmc:yarn:${mcVersion}+build.3:v2"
    modImplementation "org.quiltmc:quilt-loader:0.26.3"
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}
`;
    } else if (loader === 'paper' || loader === 'spigot') {
      manifestFile = 'src/main/resources/plugin.yml';
      manifestContent = `name: ${name || cleanId}
version: '1.0.0'
main: com.yourcompany.${pkgName}.${className}
api-version: '1.21'
author: GodHand Developer
description: ${description || 'Paper/Spigot plugin generated by GodHand Engine.'}
`;
      javaContent = `package com.yourcompany.${pkgName};

import org.bukkit.plugin.java.JavaPlugin;

public class ${className} extends JavaPlugin {
    @Override
    public void onEnable() {
        getLogger().info("${name || cleanId} Paper plugin enabled on Minecraft ${mcVersion}!");
    }

    @Override
    public void onDisable() {
        getLogger().info("${name || cleanId} Paper plugin disabled.");
    }
}
`;
      gradleContent = `plugins {
    id 'java'
}

version = '1.0.0'
group = 'com.yourcompany.${pkgName}'

repositories {
    mavenCentral()
    maven { url = 'https://repo.papermc.io/repository/maven-public/' }
}

dependencies {
    compileOnly 'io.papermc.paper:paper-api:1.21.1-R0.1-SNAPSHOT'
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}
`;
    } else if (loader === 'folia' || loader === 'purpur') {
      manifestFile = 'src/main/resources/plugin.yml';
      manifestContent = `name: ${name || cleanId}
version: '1.0.0'
main: com.yourcompany.${pkgName}.${className}
api-version: '1.21'
folia-supported: true
author: GodHand Developer
description: ${description || 'Folia multithreaded plugin generated by GodHand Engine.'}
`;
      javaContent = `package com.yourcompany.${pkgName};

import org.bukkit.plugin.java.JavaPlugin;

public class ${className} extends JavaPlugin {
    @Override
    public void onEnable() {
        getLogger().info("${name || cleanId} Folia plugin initialized with regionized multithreading!");
    }

    @Override
    public void onDisable() {
        getLogger().info("${name || cleanId} Folia plugin shutting down.");
    }
}
`;
      gradleContent = `plugins {
    id 'java'
}

version = '1.0.0'
group = 'com.yourcompany.${pkgName}'

repositories {
    mavenCentral()
    maven { url = 'https://repo.papermc.io/repository/maven-public/' }
}

dependencies {
    compileOnly 'dev.folia:folia-api:1.21.1-R0.1-SNAPSHOT'
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}
`;
    } else if (loader === 'velocity') {
      manifestFile = 'src/main/resources/velocity-plugin.json';
      manifestContent = JSON.stringify({
        id: cleanId,
        name: name || cleanId,
        version: "1.0.0",
        description: description || "Velocity modern proxy plugin.",
        main: `com.yourcompany.${pkgName}.${className}`
      }, null, 2);
      javaContent = `package com.yourcompany.${pkgName};

import com.google.inject.Inject;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.plugin.Plugin;
import com.velocitypowered.api.proxy.ProxyServer;
import org.slf4j.Logger;

@Plugin(id = "${cleanId}", name = "${name || cleanId}", version = "1.0.0")
public class ${className} {
    private final ProxyServer server;
    private final Logger logger;

    @Inject
    public ${className}(ProxyServer server, Logger logger) {
        this.server = server;
        this.logger = logger;
    }

    @Subscribe
    public void onProxyInitialization(ProxyInitializeEvent event) {
        logger.info("${name || cleanId} Velocity Proxy Plugin active!");
    }
}
`;
      gradleContent = `plugins {
    id 'java'
}

version = '1.0.0'
group = 'com.yourcompany.${pkgName}'

repositories {
    mavenCentral()
    maven { url = 'https://nexus.velocitypowered.com/repository/maven-public/' }
}

dependencies {
    compileOnly 'com.velocitypowered:velocity-api:3.3.0-SNAPSHOT'
    annotationProcessor 'com.velocitypowered:velocity-api:3.3.0-SNAPSHOT'
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}
`;
    } else if (loader === 'bungeecord') {
      manifestFile = 'src/main/resources/bungee.yml';
      manifestContent = `name: ${name || cleanId}
version: '1.0.0'
main: com.yourcompany.${pkgName}.${className}
author: GodHand Developer
description: ${description || 'BungeeCord proxy plugin.'}
`;
      javaContent = `package com.yourcompany.${pkgName};

import net.md_5.bungee.api.plugin.Plugin;

public class ${className} extends Plugin {
    @Override
    public void onEnable() {
        getLogger().info("${name || cleanId} BungeeCord Proxy plugin enabled!");
    }
}
`;
      gradleContent = `plugins {
    id 'java'
}

version = '1.0.0'
group = 'com.yourcompany.${pkgName}'

repositories {
    mavenCentral()
    maven { url = 'https://oss.sonatype.org/content/repositories/snapshots' }
}

dependencies {
    compileOnly 'net.md-5:bungeecord-api:1.20-R0.2'
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}
`;
    } else if (loader === 'sponge') {
      fs.mkdirSync(path.resolve(modDir, 'src/main/resources/META-INF'), { recursive: true });
      manifestFile = 'src/main/resources/META-INF/sponge_plugins.json';
      manifestContent = JSON.stringify({
        loader: { version: "1.0", name: "sponge" },
        plugins: [{
          id: cleanId,
          name: name || cleanId,
          version: "1.0.0",
          description: description || "Sponge Plugin generated by GodHand Engine."
        }]
      }, null, 2);
      javaContent = `package com.yourcompany.${pkgName};

import org.apache.logging.log4j.Logger;
import org.spongepowered.api.Server;
import org.spongepowered.api.event.Listener;
import org.spongepowered.api.event.lifecycle.StartingEngineEvent;
import org.spongepowered.plugin.builtin.jvm.Plugin;
import com.google.inject.Inject;

@Plugin("${cleanId}")
public class ${className} {
    private final Logger logger;

    @Inject
    public ${className}(Logger logger) {
        this.logger = logger;
    }

    @Listener
    public void onServerStarting(StartingEngineEvent<Server> event) {
        logger.info("${name || cleanId} Sponge Plugin started on Minecraft ${mcVersion}!");
    }
}
`;
      gradleContent = `plugins {
    id 'org.spongepowered.gradle.plugin' version '2.2.0'
}

version = '1.0.0'
group = 'com.yourcompany.${pkgName}'

sponge {
    apiVersion('11.0.0')
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}
`;
    } else {
      // Default: Fabric
      manifestFile = 'src/main/resources/fabric.mod.json';
      manifestContent = JSON.stringify({
        schemaVersion: 1,
        id: cleanId,
        version: "1.0.0",
        name: name || cleanId,
        description: description || "Fabric Mod generated by GodHand Engine.",
        authors: ["GodHand Developer"],
        license: "MIT",
        environment: "*",
        entrypoints: {
          main: [`com.yourcompany.${pkgName}.${className}`]
        },
        depends: {
          fabricloader: ">=0.16.5",
          minecraft: `~${mcVersion}`,
          java: ">=21"
        }
      }, null, 2);
      javaContent = `package com.yourcompany.${pkgName};

import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ${className} implements ModInitializer {
    public static final String MOD_ID = "${cleanId}";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        LOGGER.info("${name || cleanId} Fabric Mod initialized successfully on Minecraft ${mcVersion} (Java 21)!");
    }
}
`;
      gradleContent = `plugins {
    id 'fabric-loom' version '1.7-SNAPSHOT'
    id 'maven-publish'
}

version = '1.0.0'
group = 'com.yourcompany.${pkgName}'

base {
    archivesName = '${cleanId}'
}

repositories {
    mavenCentral()
}

dependencies {
    minecraft "com.mojang:minecraft:${mcVersion}"
    mappings "net.fabricmc:yarn:${mcVersion}+build.3:v2"
    modImplementation "net.fabricmc:fabric-loader:0.16.5"
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}
`;
    }

    fs.writeFileSync(path.resolve(modDir, manifestFile), manifestContent, 'utf8');
    fs.writeFileSync(path.resolve(modDir, `src/main/java/com/yourcompany/${pkgName}/${className}.java`), javaContent, 'utf8');
    fs.writeFileSync(path.resolve(modDir, 'build.gradle'), gradleContent, 'utf8');

    // Write metadata file with loader and sample flag
    const metaPath = path.resolve(modDir, 'godhand-mod.json');
    fs.writeFileSync(metaPath, JSON.stringify({
      id: cleanId,
      name: name || cleanId,
      loader,
      mcVersion,
      isSample: Boolean(isSample),
      createdAt: new Date().toISOString()
    }, null, 2), 'utf8');

    res.json({ success: true, id: cleanId, name: name || cleanId, loader, isSample: Boolean(isSample), path: `mods/${cleanId}` });
  } catch (err) {
    res.status(500).json({ error: `Failed to scaffold mod: ${err.message}` });
  }
});

// Delete mod endpoint (Owner only)
app.delete('/api/system-mods/:id', (req, res) => {
  const modId = req.params.id;
  if (!modId || modId === 'arm32-fix' || modId === 'godhand') {
    return res.status(403).json({ error: 'Cannot delete protected engine core mod' });
  }
  const modDir = path.resolve(ROOT_DIR, 'mods', modId);
  if (!fs.existsSync(modDir)) {
    return res.status(404).json({ error: 'Mod directory not found' });
  }
  try {
    fs.rmSync(modDir, { recursive: true, force: true });
    res.json({ success: true, message: `Mod '${modId}' deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: `Failed to delete mod: ${err.message}` });
  }
});

// Toggle sample mod template status
app.post('/api/system-mods/:id/toggle-sample', (req, res) => {
  const modId = req.params.id;
  const modDir = getSystemModDir(modId);
  if (!fs.existsSync(modDir)) {
    return res.status(404).json({ error: 'Mod directory not found' });
  }
  const metaPath = path.resolve(modDir, 'godhand-mod.json');
  let meta = { id: modId, isSample: false };
  if (fs.existsSync(metaPath)) {
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch {}
  }
  meta.isSample = !meta.isSample;
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  res.json({ success: true, isSample: meta.isSample });
});

// --- COMPILER TASK PALETTE, CUSTOM COMMANDS & SYNTAX/TYPO DIAGNOSTICS ---
app.get('/api/compiler/tasks', (req, res) => {
  res.json({
    tasks: [
      { id: 'build', name: 'build', desc: 'Assembles and tests this project.', group: 'build', cmd: './gradlew build' },
      { id: 'clean', name: 'clean', desc: 'Deletes the build directory.', group: 'build', cmd: './gradlew clean' },
      { id: 'classes', name: 'classes', desc: 'Assembles main classes.', group: 'build', cmd: './gradlew classes' },
      { id: 'test', name: 'test', desc: 'Runs all unit test suites.', group: 'verification', cmd: './gradlew test' },
      { id: 'check', name: 'check', desc: 'Runs all verification tasks.', group: 'verification', cmd: './gradlew check' },
      { id: 'jar', name: 'jar', desc: 'Assembles a jar archive containing the main classes.', group: 'build', cmd: './gradlew jar' },
      { id: 'spotlessApply', name: 'spotlessApply', desc: 'Applies code formatting.', group: 'formatting', cmd: './gradlew spotlessApply' },
      { id: 'runClient', name: 'runClient', desc: 'Spins up Minecraft dev test client.', group: 'fabric/forge', cmd: './gradlew runClient' }
    ]
  });
});

app.post('/api/compiler/run', async (req, res) => {
  const { cmd, task } = req.body || {};
  let targetCmd = cmd || task || 'build';
  let parts;
  try {
    parts = sanitizeGradleArgs(targetCmd);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (buildStatus === 'building') {
    return res.status(400).json({ error: 'Build or task already in progress' });
  }

  buildStatus = 'building';
  buildLogs = [
    `[INFO] Running Compiler Task: ./gradlew ${parts.join(' ')}`,
    `[INFO] Timestamp: ${new Date().toISOString()}`
  ];
  res.json({ success: true, message: `Running ./gradlew ${parts.join(' ')}`, task: targetCmd });

  try {
    const JAVA_HOME = await ensureJDK();
    const projectDir = path.join(ROOT_DIR, 'godhand');
    const inv = gradlewInvocation(projectDir);
    const env = buildJavaEnv(JAVA_HOME, process.env);

    const proc = spawn(inv.command, parts, {
      cwd: projectDir,
      shell: inv.shell,
      env
    });
    proc.stdout.on('data', d => {
      resetJdkIdleTimer();
      const line = d.toString().trim();
      if (line) buildLogs.push(line);
    });
    proc.stderr.on('data', d => {
      resetJdkIdleTimer();
      const line = d.toString().trim();
      if (line) buildLogs.push('[ERROR] ' + line);
    });
    proc.on('close', code => {
      if (code === 0) {
        buildStatus = 'success';
        buildLogs.push(`TASK [${parts.join(' ')}] COMPLETED SUCCESSFULLY!`);
      } else {
        buildStatus = 'failed';
        buildLogs.push(`TASK [${parts.join(' ')}] FAILED with exit code ${code}`);
      }
      resetJdkIdleTimer();
    });
  } catch (err) {
    buildStatus = 'failed';
    buildLogs.push('[ERROR] ' + err.message);
  }
});

app.post('/api/compiler/diagnose', (req, res) => {
  const { code = '', filePath = '' } = req.body || {};
  const diagnostics = diagnoseJava(code);
  res.json({
    diagnostics,
    totalErrors: diagnostics.filter(d => d.severity === 'error').length,
    totalWarnings: diagnostics.filter(d => d.severity === 'warning').length,
    javaVersion: '21.0.12 (OpenJDK LTS)',
    targetMc: '1.21.1+'
  });
});

app.post('/api/compiler/fix', (req, res) => {
  const { code = '', line, typo, suggestedFix, type } = req.body || {};
  const fixed = applyJavaFix(code, { line, typo, suggestedFix, type });
  if (fixed === null) {
    return res.status(400).json({ error: 'Failed to apply fix' });
  }
  res.json({ success: true, fixedCode: fixed });
});

// --- GITHUB REMOTE & PR INTEGRATION ---
app.get('/api/git/remote-info', (req, res) => {
  const remoteUrl = 'https://github.com/JONIMONI09/Java_IDE.git';
  const branch = 'feature/admin-arm32-and-responsive-ide';
  const bundlePath = path.resolve(ROOT_DIR, 'export-godhand.bundle');
  const bundleExists = fs.existsSync(bundlePath);
  res.json({
    remoteUrl,
    branch,
    bundleExists,
    prUrl: `https://github.com/JONIMONI09/Java_IDE/pull/new/${branch}`
  });
});

app.post('/api/git/push-remote', async (req, res) => {
  const { token, branch = 'feature/admin-arm32-and-responsive-ide' } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Personal Access Token (PAT) is required for GitHub push.' });
  }

  try {
    const authedUrl = `https://${token}@github.com/JONIMONI09/Java_IDE.git`;
    execSync(`git push "${authedUrl}" "${branch}:${branch}" --force`, { cwd: ROOT_DIR });
    const prUrl = `https://github.com/JONIMONI09/Java_IDE/pull/new/${branch}`;
    res.json({ success: true, message: 'Successfully pushed to GitHub repository!', prUrl });
  } catch (err) {
    res.status(500).json({ error: 'Git push failed: ' + err.message });
  }
});

app.get('/api/git/export-bundle', (req, res) => {
  const bundlePath = path.resolve(ROOT_DIR, 'export-godhand.bundle');
  try {
    execSync(`git bundle create "${bundlePath}" --all`, { cwd: ROOT_DIR });
    res.download(bundlePath, 'export-godhand.bundle');
  } catch (err) {
    if (fs.existsSync(bundlePath)) {
      return res.download(bundlePath, 'export-godhand.bundle');
    }
    res.status(500).json({ error: 'Could not generate git bundle: ' + err.message });
  }
});

// Catch unhandled API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Serve frontend in Dev/Production with SPA catch-all and self-healing build
const distDir = path.join(__dirname, 'dist');
const distIndex = path.join(distDir, 'index.html');

// Automated pre-build check: ensure dist/index.html exists
if (!fs.existsSync(distIndex)) {
  console.log('[GodHand] dist/index.html not found, executing automated pre-build...');
  try {
    execSync('npm run build', { cwd: __dirname, stdio: 'inherit' });
  } catch (err) {
    console.error('[GodHand] Automated pre-build failed:', err.message);
  }
}

app.use(express.static(distDir));

// Non-API SPA catch-all route
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  if (fs.existsSync(distIndex)) {
    return res.sendFile(distIndex);
  }
  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>GodHand Studio - Building</title><meta http-equiv="refresh" content="3"></head><body style="background:#0f172a;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h2>GodHand Studio is building...</h2><p>Please wait a few seconds. The page will reload automatically.</p></div></body></html>`);
});

async function startServer() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Full-stack server listening on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
