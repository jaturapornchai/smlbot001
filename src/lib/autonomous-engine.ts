import { getAllBots, getBotById, updateBot } from './bot-store';
import { callAIWithCascadeFallback } from './ai-gateway';
import { getVMStatus, startVM, withBotSlot } from './vm-orchestrator';
import { BotActivityLog } from '@/types/bot';

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
  const autonomousPrompt = `[รอบอัตโนมัติ 24/7] คุณคือ ${bot.name} (${bot.role})
เป้าหมายต่อเนื่อง: "${bot.autonomousGoal || bot.description || 'ตรวจสอบความพร้อมและบริหารจัดการงานประจำบทบาท'}"
ปฏิบัติภารกิจรอบนี้ แล้วสรุปผลภาษาไทย 2-3 บรรทัด สั้น ตรงไปตรงมา`;

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

  const intervalMinutes = Math.min(1440, Math.max(1, bot.autonomousIntervalMinutes || 15));
  const nextRun = new Date(now.getTime() + intervalMinutes * 60 * 1000).toISOString();

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

  // 2. รันรอบงานของบอทที่เปิดโหมด Autonomous
  for (const bot of bots) {
    if (bot.status !== 'active') continue;
    if (!bot.autonomousEnabled && !forceAll) continue;

    const isDue =
      forceAll ||
      !bot.nextAutonomousRunAt ||
      new Date(bot.nextAutonomousRunAt).getTime() <= now.getTime();
    if (!isDue) continue;

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

  return {
    timestamp: now.toISOString(),
    botsProcessed: bots.length,
    tasksExecuted,
    selfHealed: healLogs.length,
    logs: allLogs,
  };
}
