import { getAllBots, getBotById, updateBot } from './bot-store';
import { callAIWithCascadeFallback } from './ai-gateway';
import { getVMStatus, startVM, withBotSlot } from './vm-orchestrator';
import { createHash } from 'crypto';
import { BotActivityLog, BotProperty } from '@/types/bot';

// Autonomous เขียน log 3 ชนิดนี้เอง → ไม่นับเป็นเหตุการณ์ใหม่ ไม่งั้นจะปลุกตัวเองทุกรอบ
const OWN_LOG_TYPES = new Set<BotActivityLog['actionType']>(['autonomous_run', 'failover', 'clone_spawn']);
const MAX_EVENTS_IN_PROMPT = 5;

const goalOf = (bot: BotProperty) => bot.autonomousGoal || bot.description || 'ตรวจสอบความพร้อมและบริหารจัดการงานประจำบทบาท';

// ลุงจืดแก้เป้าหมาย/คำสั่งบอท = งานใหม่ (ใช้ updatedAt ไม่ได้ เพราะ updateBot ขยับทุกครั้งที่บันทึก busy/log)
const promptHash = (bot: BotProperty) =>
  createHash('sha1').update(JSON.stringify([bot.name, bot.role, goalOf(bot), bot.systemPrompt])).digest('hex').slice(0, 16);

function newEventsSince(bot: BotProperty): BotActivityLog[] {
  const since = bot.lastAutonomousRunAt ? Date.parse(bot.lastAutonomousRunAt) : 0;
  return (bot.activityLogs || []).filter((l) => !OWN_LOG_TYPES.has(l.actionType) && Date.parse(l.timestamp) > since);
}

// ประหยัด token: ไม่มีงาน/เหตุการณ์ใหม่ = prompt เหมือนรอบก่อนทุกตัวอักษร ผลก็ซ้ำเดิม → ไม่ต้องเรียก AI
const hasNewWork = (bot: BotProperty) => promptHash(bot) !== bot.autonomousPromptHash || newEventsSince(bot).length > 0;

function nextRunAt(bot: BotProperty, now: Date): string {
  const intervalMinutes = Math.min(1440, Math.max(1, bot.autonomousIntervalMinutes || 15));
  return new Date(now.getTime() + intervalMinutes * 60 * 1000).toISOString();
}

export interface AutonomousTickResult {
  timestamp: string;
  botsProcessed: number;
  tasksExecuted: number;
  selfHealed: number;
  logs: BotActivityLog[];
}

/**
 * รันรอบการทำงานอัตโนมัติของบอท 1 ตัว (Autonomous Execution Cycle)
 */
export async function runAutonomousCycleForBot(botId: string): Promise<BotActivityLog | null> {
  const bot = getBotById(botId);
  if (!bot || bot.status !== 'active') return null;

  const now = new Date();

  // ประหยัด token: systemPrompt ของบอทไปอยู่ช่อง system (ต้นเดียวกับแชท/ภารกิจ → DeepSeek นับ cache hit) คำสั่งรอบนี้สั้นที่สุด
  const events = newEventsSince(bot).slice(0, MAX_EVENTS_IN_PROMPT);
  const eventText = events.length ? `\nเหตุการณ์ใหม่ตั้งแต่รอบก่อน:\n${events.map((e) => `- ${e.summary}`).join('\n')}` : '';
  const autonomousPrompt = `[รอบอัตโนมัติ 24/7] คุณคือ ${bot.name} (${bot.role})
เป้าหมายต่อเนื่อง: "${goalOf(bot)}"
ปฏิบัติภารกิจรอบนี้ แล้วสรุปผลภาษาไทย 2-3 บรรทัด สั้น ตรงไปตรงมา${eventText}`;

  let resultSummary = '';
  let status: 'success' | 'warning' | 'error' = 'success';
  let actionType: BotActivityLog['actionType'] = 'autonomous_run';

  try {
    // บอทไม่ว่าง → ยืม Clone ทำแทน; จบงานแล้วคืนสถานะ busy/clone ให้เสมอแม้ AI ล่ม
    const task = `ปฏิบัติภารกิจอัตโนมัติ: ${(bot.autonomousGoal || '').slice(0, 60)}`;
    const { result: aiResponse, clone } = await withBotSlot(bot.id, task, () =>
      callAIWithCascadeFallback({
        botName: bot.name,
        primaryProviderId: bot.providerId,
        primaryModelName: bot.modelName,
        fallbackProviderId: bot.fallbackProviderId,
        fallbackModelName: bot.fallbackModelName,
        temperature: bot.temperature,
        maxTokens: 300, // สรุป 2-3 บรรทัด: เพดานต่ำกันตอบยาวเกิน (output แพงกว่า input 4 เท่า)
        systemPrompt: bot.systemPrompt,
        messages: [{ role: 'user', content: autonomousPrompt }],
      })
    );

    resultSummary = aiResponse.isFallback
      ? `[Auto-Failover สลับใช้ ${aiResponse.usedModel}]: ${aiResponse.content}`
      : aiResponse.content;
    if (aiResponse.isFallback) actionType = 'failover';
    else if (clone) actionType = 'clone_spawn';
    if (clone) resultSummary = `[${clone.name} รับงานแทนเพราะตัวหลักไม่ว่าง] ${resultSummary}`;
  } catch (err: any) {
    resultSummary = `ขัดข้อง: ไม่พบ AI ตัวใดในระบบที่พร้อมทำงาน (${err.message})`;
    status = 'error';
  }

  const nextRun = nextRunAt(bot, now);

  const activityLog: BotActivityLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    botId: bot.id,
    botName: bot.name,
    timestamp: now.toISOString(),
    actionType,
    summary: resultSummary.slice(0, 180),
    details: resultSummary,
    status,
  };

  // อ่านบอทล่าสุดก่อนเขียน: ระหว่างรอ AI อาจมีคนแก้บอทหรือมี log อื่นเข้ามา (เดิมเขียนทับด้วยข้อมูลเก่า)
  const latest = getBotById(bot.id) || bot;
  const updatedLogs = [activityLog, ...(latest.activityLogs || [])].slice(0, 20); // เก็บล่าสุด 20 รายการ

  updateBot(bot.id, {
    lastAutonomousRunAt: now.toISOString(),
    nextAutonomousRunAt: nextRun,
    autonomousPromptHash: promptHash(bot),
    activityLogs: updatedLogs,
    stats: {
      ...latest.stats,
      totalRuns: (latest.stats?.totalRuns || 0) + 1,
      lastRunAt: now.toISOString(),
    },
  });

  return activityLog;
}

/**
 * ระบบ Self-Healing ตรวจสอบและกู้คืน VM Container ที่หยุดทำงานอัตโนมัติ
 */
export async function runSelfHealingCheck(): Promise<BotActivityLog[]> {
  const healLogs: BotActivityLog[] = [];

  for (const bot of getAllBots()) {
    if (bot.status !== 'active' || !bot.vmConfig?.containerName) continue;
    try {
      const vmStat = await getVMStatus(bot.vmConfig.containerName);
      if (vmStat.status !== 'stopped') continue;

      const started = await startVM(bot.vmConfig.containerName);
      const healLog: BotActivityLog = {
        id: `heal-${Date.now()}-${bot.id}`,
        botId: bot.id,
        botName: bot.name,
        timestamp: new Date().toISOString(),
        actionType: 'self_heal',
        summary: started
          ? `Self-Healing อัตโนมัติ: ตรวจพบ VM (${bot.vmConfig.containerName}) หยุดทำงาน ระบบสั่งสตาร์ทคืนชีพแล้ว`
          : `Self-Healing ล้มเหลว: VM (${bot.vmConfig.containerName}) หยุดทำงานและสั่งสตาร์ทไม่สำเร็จ`,
        status: started ? 'warning' : 'error',
      };
      healLogs.push(healLog);
      const latest = getBotById(bot.id) || bot;
      updateBot(bot.id, {
        vmConfig: { ...bot.vmConfig, status: started ? 'running' : 'error' },
        activityLogs: [healLog, ...(latest.activityLogs || [])].slice(0, 20),
      });
    } catch (err: any) {
      console.warn(`Self-heal check failed for ${bot.name}:`, err.message);
    }
  }

  return healLogs;
}

let tickRunning = false;

/**
 * Global Autonomous Tick: ประมวลผลรอบอัตโนมัติของทั้งระบบ
 * คืน null เมื่อรอบก่อนยังไม่จบ (scheduler + ปุ่มกดพร้อมกัน / AI ช้า) — กันยิง AI ซ้อนกับบอทตัวเดิม
 */
export async function runGlobalAutonomousTick(forceAll: boolean = false): Promise<AutonomousTickResult | null> {
  if (tickRunning) return null;
  tickRunning = true;
  try {
    return await runTick(forceAll);
  } finally {
    tickRunning = false;
  }
}

async function runTick(forceAll: boolean): Promise<AutonomousTickResult> {
  const now = new Date();
  const bots = getAllBots();
  const allLogs: BotActivityLog[] = [];

  // 1. Self-Healing ตรวจสอบ VM ทุกตัว
  const healLogs = await runSelfHealingCheck();
  allLogs.push(...healLogs);

  let tasksExecuted = 0;
  let skippedIdle = 0;

  // 2. รันรอบงานของบอทที่เปิดโหมด Autonomous
  for (const bot of bots) {
    if (bot.status !== 'active') continue;
    if (!bot.autonomousEnabled && !forceAll) continue;

    const isDue =
      forceAll ||
      !bot.nextAutonomousRunAt ||
      new Date(bot.nextAutonomousRunAt).getTime() <= now.getTime();
    if (!isDue) continue;

    // อ่านใหม่: Self-Healing ด้านบนอาจเพิ่ม log; กดรันเอง (forceAll) = ลุงจืดสั่ง ไม่ข้าม
    if (!forceAll && !hasNewWork(getBotById(bot.id) || bot)) {
      // ponytail: ไม่เขียน log รอบที่ข้าม (จะดัน log จริงตกจาก 20 รายการล่าสุด) เลื่อนรอบถัดไปอย่างเดียว
      updateBot(bot.id, { nextAutonomousRunAt: nextRunAt(bot, now) });
      skippedIdle++;
      continue;
    }

    try {
      const log = await runAutonomousCycleForBot(bot.id);
      if (log) {
        allLogs.push(log);
        tasksExecuted++;
      }
    } catch (e: any) {
      console.error(`Autonomous cycle error for bot ${bot.name}:`, e.message);
    }
  }

  if (skippedIdle) console.info(`[Autonomous] ข้าม ${skippedIdle} บอท: ไม่มีงาน/เหตุการณ์ใหม่ (ไม่เรียก AI)`);

  return {
    timestamp: now.toISOString(),
    botsProcessed: bots.length,
    tasksExecuted,
    selfHealed: healLogs.length,
    logs: allLogs,
  };
}
