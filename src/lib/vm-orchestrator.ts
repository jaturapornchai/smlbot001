import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { BotVMConfig, BotProperty, BotCloneInstance } from '@/types/bot';
import { getProviderById } from './ai-store';
import { getAllBots, getBotById, updateBot } from './bot-store';

const execAsync = util.promisify(exec);

const REMOTE_HOST = process.env.REMOTE_DOCKER_HOST || 'smlsoft@192.168.2.88';
// Windows: cmd.exe ไม่รู้จัก quote แบบ POSIX ('name=smlbot-') และ path /home/... ใช้ไม่ได้ → สั่งผ่าน SSH เหมือนโหมด dev
const IS_REMOTE =
  process.env.NODE_ENV !== 'production' || process.env.USE_SSH_DOCKER === 'true' || process.platform === 'win32';
// path เดียวกันทั้งบนโฮสต์และใน smlbot-console (docker-compose mount ไว้ตรงกัน)
const BOTS_DIR = '/home/smlsoft/smlbot/bots';
const START_PORT = 50001;
const SAFE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}$/;

// ชื่อคอนเทนเนอร์/botId ถูกต่อเข้า shell command ตรง ๆ → ต้องเป็นอักขระปลอดภัยเท่านั้น กัน command injection
function safeName(name: string): string {
  if (!SAFE_NAME.test(name)) throw new Error(`ชื่อคอนเทนเนอร์ไม่ปลอดภัย: ${name}`);
  return name;
}

export async function runDockerCommand(cmd: string): Promise<string> {
  const fullCommand = IS_REMOTE
    ? `ssh -o BatchMode=yes -o ConnectTimeout=10 ${REMOTE_HOST} "${cmd.replace(/"/g, '\\"')}"`
    : cmd;

  try {
    // ครั้งแรก docker run ต้อง pull image Agent Zero (หลาย GB) จึงเผื่อเวลาไว้ 15 นาที
    const { stdout } = await execAsync(fullCommand, { timeout: 15 * 60 * 1000 });
    return stdout.trim();
  } catch (error: any) {
    // error.message ของ exec มีคำสั่งเต็มทั้งบรรทัด → ห้าม log/ส่งต่อ ใช้แค่ stderr บรรทัดสุดท้าย
    const reason =
      String(error.stderr || '').trim().split('\n').pop() ||
      (error.killed ? 'คำสั่ง Docker หมดเวลา' : `exit ${error.code}`);
    console.error(`[docker] ${cmd.split(' ').slice(0, 2).join(' ')} ล้มเหลว: ${reason}`);
    throw new Error(reason);
  }
}

// เขียนไฟล์ลงโฮสต์ Docker: เนื้อหาไม่ผ่าน shell/argv (มี API Key) จึงไม่โผล่ใน ps และไม่โดนตีความอักขระพิเศษ
async function writeHostFile(file: string, content: string): Promise<void> {
  const dir = path.posix.dirname(file);
  if (!IS_REMOTE) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, content, { mode: 0o600 });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn('ssh', [
      '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', REMOTE_HOST,
      `mkdir -p '${dir}' && umask 077 && cat > '${file}'`,
    ]);
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr.trim() || `ssh exit ${code}`))));
    child.stdin.end(content);
  });
}

// พอร์ตที่กำลัง launch อยู่ (ยังไม่โผล่ใน docker ps) กัน deploy พร้อมกันแล้วได้พอร์ตซ้ำ
const pendingPorts = new Set<number>();

async function allocateNextPort(): Promise<number> {
  const output = await runDockerCommand("docker ps -a --filter 'name=smlbot-' --format '{{.Ports}}'");
  const usedPorts = new Set<number>();
  for (const m of output.matchAll(/:(\d+)->/g)) usedPorts.add(parseInt(m[1], 10));
  let port = START_PORT;
  while (usedPorts.has(port) || pendingPorts.has(port)) port++;
  return port;
}

function envLine(key: string, value: string): string {
  return `${key}=${value.replace(/[\r\n]+/g, ' ')}`;
}

// ใช้ provider ของบอทจริง (base URL + key คู่กัน) — เดิม Clone ฝัง DeepSeek URL แต่ใช้ key ของ provider อื่น
function agentZeroEnv(displayName: string, providerId: string, modelName: string): string {
  const provider = getProviderById(providerId) || getProviderById('deepseek');
  const baseUrl = provider?.baseUrl || 'https://api.deepseek.com/v1';
  const apiKey = provider?.apiKey || (baseUrl.includes('deepseek') ? process.env.DEEPSEEK_API_KEY : '') || '';
  const model = modelName || provider?.defaultModel || 'deepseek-chat';
  return (
    [
      envLine('BOT_NAME', displayName),
      envLine('ALLOWED_ORIGINS', '*,*://*'),
      envLine('OPENAI_API_BASE', baseUrl),
      envLine('OPENAI_API_KEY', apiKey),
      envLine('CHAT_MODEL', model),
      envLine('UTILITY_MODEL', model),
      envLine('EMBEDDING_MODEL', 'text-embedding-3-small'),
    ].join('\n') + '\n'
  );
}

/** สร้าง (หรือสร้างใหม่) คอนเทนเนอร์ Agent Zero 1 ตัว ใช้ทั้ง VM หลักและ Clone */
async function launchAgentZero(p: {
  instanceId: string;
  displayName: string;
  providerId: string;
  modelName: string;
  hostPort?: number;
}): Promise<{ containerName: string; hostPort: number; usrDir: string }> {
  const instanceId = safeName(p.instanceId);
  const containerName = `smlbot-${instanceId}`;
  const usrDir = `${BOTS_DIR}/${instanceId}/usr`;
  const hostPort = p.hostPort || (await allocateNextPort());
  pendingPorts.add(hostPort);

  try {
    const env = agentZeroEnv(p.displayName, p.providerId, p.modelName);
    await writeHostFile(`${usrDir}/secrets.env`, env);
    await writeHostFile(`${usrDir}/.env`, env);

    // ลบตัวเดิมถ้ามี (redeploy) ก่อนรันใหม่บนพอร์ตเดิม
    await removeVM(containerName);
    await runDockerCommand(
      [
        `docker run -d`,
        `--name ${containerName}`,
        `--restart unless-stopped`,
        `-e ALLOWED_ORIGINS="*"`,
        `-p ${hostPort}:80`,
        `-v ${usrDir}:/a0/usr`,
        `agent0ai/agent-zero:latest`,
      ].join(' ')
    );
  } finally {
    pendingPorts.delete(hostPort);
  }

  // Inject CSRF patch เพื่อให้เข้าใช้งานผ่านเบราว์เซอร์และ iframe ได้ 100% (รอคอนเทนเนอร์พร้อมก่อน)
  const patchScript = `python3 -c \\"p='/a0/api/csrf_token.py'; c=open(p).read(); t='async def is_allowed_origin(self, request: Request):'; r='async def is_allowed_origin(self, request: Request):\\\\n        return {\\\\\\"ok\\\\\\": True, \\\\\\"origin\\\\\\": \\\\\"*\\\\\", \\\\\\"allowed_origins\\\\\\": [\\\\\"*\\\\\"]}'; (open(p, 'w').write(c.replace(t, r, 1))) if t in c and 'ok\\\\\\\": True' not in c else None\\" && supervisorctl restart run_ui`;
  setTimeout(() => {
    runDockerCommand(`docker exec ${containerName} sh -c "${patchScript}"`).catch(() => {});
  }, 4000);

  return { containerName, hostPort, usrDir };
}

export async function deployAgentZeroVM(bot: BotProperty, allocatedPort?: number): Promise<BotVMConfig> {
  const { containerName, hostPort, usrDir } = await launchAgentZero({
    instanceId: bot.id,
    displayName: bot.name,
    providerId: bot.providerId,
    modelName: bot.modelName,
    hostPort: allocatedPort,
  });
  // ไม่เก็บ uiUrl ที่มี IP เซิร์ฟเวอร์: หน้าเว็บประกอบลิงก์จาก hostname ที่เปิดอยู่ + พอร์ต
  return {
    containerName,
    hostPort,
    volumePath: usrDir,
    status: 'running',
    restartPolicy: 'unless-stopped',
    uptime: 'เพิ่งเริ่มทำงาน',
  };
}

function patchClone(botId: string, cloneId: string, patch: Partial<BotCloneInstance>): void {
  const bot = getBotById(botId);
  if (!bot?.clones) return;
  updateBot(botId, { clones: bot.clones.map((c) => (c.id === cloneId ? { ...c, ...patch } : c)) });
}

/**
 * เพิ่ม Clone VM ใหม่ 1 ตัว (ไม่เกิน maxClones) — คืน null ถ้าครบโควตาแล้ว
 * มี task = มีงานรออยู่ → Clone เกิดมาในสถานะ busy เลย ไม่ให้งานอื่นแย่งไป
 */
export async function addClone(botId: string, task?: string): Promise<BotCloneInstance | null> {
  const bot = getBotById(botId);
  if (!bot) throw new Error('ไม่พบ Bot');
  const clones = bot.clones || [];
  if (clones.length >= (bot.maxClones ?? 0)) return null;

  // เลขถัดจากตัวที่มากสุด (ไม่ใช่ length+1) กันชื่อชนเมื่อเคยลบ Clone กลางรายการ
  const cloneIndex = Math.max(0, ...clones.map((c) => c.cloneIndex)) + 1;
  const cloneId = `${bot.id}-clone-${cloneIndex}`;
  const name = `${bot.name} (Clone #${cloneIndex})`;
  // จองช่องก่อน await: งานที่เข้ามาพร้อมกันจะนับรวมตัวนี้ ไม่ spawn เกิน maxClones
  const reserved: BotCloneInstance = {
    id: cloneId,
    cloneIndex,
    name,
    containerName: `smlbot-${cloneId}`,
    hostPort: 0,
    status: 'busy',
    currentTask: task || 'กำลังสร้าง Clone VM',
    createdAt: new Date().toISOString(),
  };
  updateBot(botId, { clones: [...clones, reserved] });

  try {
    const { containerName, hostPort } = await launchAgentZero({
      instanceId: cloneId,
      displayName: name,
      providerId: bot.providerId,
      modelName: bot.modelName,
    });
    const ready: Partial<BotCloneInstance> = task
      ? { containerName, hostPort, status: 'busy', currentTask: task }
      : { containerName, hostPort, status: 'idle', currentTask: undefined };
    patchClone(botId, cloneId, ready);
    return { ...reserved, ...ready };
  } catch (e) {
    updateBot(botId, { clones: (getBotById(botId)?.clones || []).filter((c) => c.id !== cloneId) });
    throw e;
  }
}

/** ขอ Clone มารับงาน: ใช้ตัวที่ว่างอยู่ก่อน ไม่มีค่อยสร้างใหม่ */
export async function acquireClone(botId: string, task: string): Promise<BotCloneInstance | null> {
  const free = getBotById(botId)?.clones?.find((c) => c.status !== 'busy');
  if (free) {
    patchClone(botId, free.id, { status: 'busy', currentTask: task });
    return { ...free, status: 'busy', currentTask: task };
  }
  return addClone(botId, task);
}

/** คืน Clone เป็นว่าง (คอนเทนเนอร์ยังรันอยู่ ให้งานถัดไปใช้ต่อ) */
export function releaseClone(botId: string, cloneId: string): void {
  patchClone(botId, cloneId, { status: 'idle', currentTask: undefined });
}

/**
 * ครอบงาน 1 ชิ้นของบอท: บอทว่าง → ตั้ง busy แล้วคืนค่าใน finally เสมอ
 * บอทไม่ว่าง + เปิด Auto-Clone → ยืม Clone แล้วคืนใน finally (สร้าง Clone ไม่ได้ก็ยังทำงานต่อ ไม่ทิ้งงาน)
 */
export async function withBotSlot<T>(
  botId: string,
  task: string,
  work: () => Promise<T>
): Promise<{ result: T; clone: BotCloneInstance | null }> {
  const bot = getBotById(botId);
  if (!bot) throw new Error('ไม่พบ Bot');
  const label = task.slice(0, 120);

  if (!bot.isBusy) {
    updateBot(botId, { isBusy: true, activeTask: label });
    try {
      return { result: await work(), clone: null };
    } finally {
      updateBot(botId, { isBusy: false, activeTask: undefined });
    }
  }

  let clone: BotCloneInstance | null = null;
  if (bot.autoCloneEnabled) {
    try {
      clone = await acquireClone(botId, label);
    } catch (e: any) {
      console.warn(`[Clone] สร้าง Clone ให้ ${bot.name} ไม่สำเร็จ: ${e.message}`);
    }
  }
  try {
    return { result: await work(), clone };
  } finally {
    if (clone) releaseClone(botId, clone.id);
  }
}

/** console รีสตาร์ท = งานที่ค้างใน memory ตายหมด → ล้างสถานะ busy ที่ค้างใน bots.json */
export function resetStaleBusyState(): void {
  for (const bot of getAllBots()) {
    if (!bot.isBusy && !bot.clones?.some((c) => c.status === 'busy')) continue;
    updateBot(bot.id, {
      isBusy: false,
      activeTask: undefined,
      clones: (bot.clones || [])
        .filter((c) => c.hostPort > 0) // ช่องที่จองไว้แต่ launch ไม่จบ
        .map((c) => ({ ...c, status: 'idle' as const, currentTask: undefined })),
    });
  }
}

export async function startVM(containerName: string): Promise<boolean> {
  try {
    await runDockerCommand(`docker start ${safeName(containerName)}`);
    return true;
  } catch {
    return false;
  }
}

export async function stopVM(containerName: string): Promise<boolean> {
  try {
    await runDockerCommand(`docker stop ${safeName(containerName)}`);
    return true;
  } catch {
    return false;
  }
}

export async function restartVM(containerName: string): Promise<boolean> {
  try {
    await runDockerCommand(`docker restart ${safeName(containerName)}`);
    return true;
  } catch {
    return false;
  }
}

/** true = ลบแล้ว หรือไม่มีคอนเทนเนอร์นี้อยู่แล้ว */
export async function removeVM(containerName: string): Promise<boolean> {
  try {
    await runDockerCommand(`docker rm -f ${safeName(containerName)}`);
    return true;
  } catch (e: any) {
    return /no such container/i.test(e.message);
  }
}

export async function getVMStatus(containerName: string): Promise<{
  status: 'running' | 'stopped' | 'not_found';
  uptime?: string;
}> {
  try {
    const res = await runDockerCommand(
      `docker inspect -f '{{.State.Status}} {{.State.StartedAt}}' ${safeName(containerName)}`
    );
    const [status, startedAt] = res.split(' ');
    return {
      status: status === 'running' ? 'running' : 'stopped',
      uptime: startedAt,
    };
  } catch {
    return { status: 'not_found' };
  }
}
