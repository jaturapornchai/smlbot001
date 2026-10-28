import { KafkaMessage } from 'kafkajs';
import { getAllBots, getBotById, updateBot } from './bot-store';
import { callAIWithCascadeFallback } from './ai-gateway';
import { withBotSlot } from './vm-orchestrator';
import { getKafka, getRedisClient, registerBotHeartbeat, sendCrossProvinceMessage } from './broker-hub';
import { BotActivityLog } from '@/types/bot';

// Console นี้ = 1 โหนดของ Cloud Hub: ส่ง heartbeat ของบอทในเครื่องเอง (ไม่ต้องรอมีคนเปิดหน้าเว็บ)
// และรับภารกิจจาก smlbot.tasks มาให้บอทในเครื่องทำจริง แล้วส่งผลกลับทาง smlbot.messages
export const LOCAL_PROVINCE = process.env.BROKER_PROVINCE || 'นนทบุรี / กรุงเทพฯ (Local Core)';
// แต่ละ Console (จังหวัด) ต้องมี consumer group ของตัวเอง ถ้าใช้ group เดียวกัน Kafka จะแบ่ง partition ข้าม Console
// แล้วงานของบอทเราไปตกที่ Console อื่นที่ไม่มีบอทนั้น → งานหาย
const NODE_ID = (process.env.BROKER_NODE_ID || 'core').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 60) || 'core';
const HEARTBEAT_MS = 30_000; // TTL ใน registry 90 วิ → ส่งทุก 30 วิ พลาดได้ 2 รอบก่อนหลุด
const RETRY_MS = 30_000;
const MAX_TASK_CHARS = 2000;
const MAX_RESULT_CHARS = 4000;

export async function heartbeatLocalBots(): Promise<void> {
  await Promise.all(
    getAllBots().map((b) =>
      registerBotHeartbeat(b.id, {
        botName: b.name,
        province: LOCAL_PROVINCE,
        status: b.isBusy ? 'busy' : 'online',
        meta: { workMode: b.workMode, modelName: b.modelName, vmPort: b.vmConfig?.hostPort },
      })
    )
  );
}

function appendActivityLog(botId: string, actionType: BotActivityLog['actionType'], text: string, status: BotActivityLog['status']) {
  const bot = getBotById(botId);
  if (!bot) return;
  const log: BotActivityLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    botId,
    botName: bot.name,
    timestamp: new Date().toISOString(),
    actionType,
    summary: text.slice(0, 180),
    details: text,
    status,
  };
  updateBot(botId, { activityLogs: [log, ...(bot.activityLogs || [])].slice(0, 20) });
}

// Kafka ส่งแบบ at-least-once (rebalance/รีสตาร์ทก่อน commit offset → ได้ข้อความซ้ำ) → กันเรียก AI ซ้ำด้วย Redis SET NX
// ใส่ timestamp ของ record ใน key ด้วย เผื่อ topic ถูกสร้างใหม่แล้ว offset เริ่มนับใหม่
async function isFirstDelivery(topic: string, partition: number, message: KafkaMessage): Promise<boolean> {
  const key = `smlbot:hub:done:${NODE_ID}:${topic}:${partition}:${message.offset}:${message.timestamp}`;
  try {
    return (await getRedisClient().set(key, '1', 'EX', 86_400, 'NX')) === 'OK';
  } catch {
    return true; // Redis ล่ม: ยอมทำซ้ำได้ ดีกว่างานหาย
  }
}

// ข้อมูลจาก Kafka = input ภายนอก (บอทจังหวัดอื่นส่งมา) → ตรวจชนิด/ความยาวก่อนใช้ และรับเฉพาะบอทที่อยู่ในเครื่องนี้
function parseMessage(message: KafkaMessage) {
  try {
    const m = JSON.parse(message.value?.toString() || '');
    if (!m || typeof m.fromBotId !== 'string' || typeof m.toBotId !== 'string' || typeof m.action !== 'string') return null;
    if (!getBotById(m.toBotId)) return null;
    return { fromBotId: m.fromBotId.slice(0, 120), toBotId: m.toBotId, action: m.action, payload: m.payload ?? {} };
  } catch {
    return null;
  }
}

async function runIncomingTask(fromBotId: string, toBotId: string, task: string) {
  const bot = getBotById(toBotId)!;
  let ok = true;
  let result: string;
  let usedModel = bot.modelName;
  if (bot.status !== 'active') {
    ok = false;
    result = `${bot.name} ปิดใช้งานอยู่ จึงไม่รับภารกิจ`;
  } else {
    try {
      const { result: ai } = await withBotSlot(bot.id, `ภารกิจข้ามจังหวัด: ${task.slice(0, 60)}`, () =>
        callAIWithCascadeFallback({
          botName: bot.name,
          primaryProviderId: bot.providerId,
          primaryModelName: bot.modelName,
          fallbackProviderId: bot.fallbackProviderId,
          fallbackModelName: bot.fallbackModelName,
          temperature: bot.temperature,
          maxTokens: bot.maxTokens,
          systemPrompt: bot.systemPrompt,
          messages: [
            {
              role: 'user',
              content: `ภารกิจข้ามจังหวัดจากบอท ${fromBotId}:\n${task}\n\nปฏิบัติภารกิจนี้แล้วรายงานผลเป็นภาษาไทย สั้น กระชับ ตรงประเด็น`,
            },
          ],
        })
      );
      result = ai.content;
      usedModel = ai.usedModel;
    } catch (err) {
      ok = false;
      result = `ไม่พบ AI ตัวใดในระบบที่พร้อมทำงาน (${(err as Error).message})`;
    }
  }

  appendActivityLog(bot.id, 'task_complete', `รับภารกิจจาก ${fromBotId}: ${task.slice(0, 60)} → ${result}`, ok ? 'success' : 'error');
  const sent = await sendCrossProvinceMessage('smlbot.messages', {
    fromBotId: bot.id,
    toBotId: fromBotId,
    province: LOCAL_PROVINCE,
    action: 'task_result',
    payload: { task: task.slice(0, 500), result: result.slice(0, MAX_RESULT_CHARS), ok, usedModel },
  });
  if (!sent) console.warn(`[HubNode] ส่งผลภารกิจกลับไปหา ${fromBotId} ไม่สำเร็จ`);
}

async function handleMessage(topic: string, partition: number, message: KafkaMessage) {
  const m = parseMessage(message);
  if (!m) return; // ไม่ใช่ของบอทในเครื่องนี้ หรือรูปแบบผิด
  const isTask = topic === 'smlbot.tasks' && m.action === 'task' && typeof m.payload.task === 'string' && m.payload.task.trim();
  const isResult = topic === 'smlbot.messages' && m.action === 'task_result' && typeof m.payload.result === 'string';
  if (!isTask && !isResult) return;
  if (!(await isFirstDelivery(topic, partition, message))) return;

  if (isTask) {
    await runIncomingTask(m.fromBotId, m.toBotId, m.payload.task.trim().slice(0, MAX_TASK_CHARS));
  } else {
    // ผลตอบกลับไม่ถูกส่งต่อให้ AI อีก → ไม่มีทางวนส่งงานกันไม่จบ
    const ok = m.payload.ok !== false;
    appendActivityLog(m.toBotId, 'task_complete', `ผลภารกิจจาก ${m.fromBotId}: ${String(m.payload.result).slice(0, MAX_RESULT_CHARS)}`, ok ? 'success' : 'warning');
  }
}

async function startTaskConsumer(): Promise<void> {
  const consumer = getKafka().consumer({ groupId: `smlbot-console-${NODE_ID}`, sessionTimeout: 60_000 });
  const retry = () => setTimeout(() => void startTaskConsumer(), RETRY_MS);
  // kafkajs restart เองเมื่อ error ชั่วคราว; ถ้ามันยอมแพ้ (restart=false) consumer ตาย → เริ่มใหม่เอง
  consumer.on(consumer.events.CRASH, (e) => {
    if (!e.payload.restart) {
      console.error('[HubNode] Task consumer หยุดทำงาน จะเริ่มใหม่:', e.payload.error?.message);
      retry();
    }
  });
  try {
    await consumer.connect();
    await consumer.subscribe({ topics: ['smlbot.tasks', 'smlbot.messages'], fromBeginning: false });
    // ponytail: ทำทีละข้อความ (ช้าแต่ commit offset หลังทำเสร็จจริง งานไม่หาย) ถ้างานล้นค่อยเพิ่ม partitionsConsumedConcurrently
    await consumer.run({
      eachMessage: async ({ topic, partition, message, heartbeat }) => {
        // AI อาจตอบนานกว่า sessionTimeout → ส่ง heartbeat ระหว่างรอ ไม่ให้ถูกเตะออกจาก group แล้วได้งานซ้ำ
        const beat = setInterval(() => heartbeat().catch(() => {}), 10_000);
        try {
          await handleMessage(topic, partition, message);
        } catch (err) {
          console.error('[HubNode] ประมวลผลข้อความไม่สำเร็จ:', (err as Error).message); // ห้าม throw: kafkajs จะวนทำข้อความเดิม
        } finally {
          clearInterval(beat);
        }
      },
    });
    console.log(`[HubNode] รับภารกิจจาก Cloud Hub แล้ว (group smlbot-console-${NODE_ID})`);
  } catch (err) {
    console.warn('[HubNode] เชื่อม Kafka ไม่สำเร็จ จะลองใหม่:', (err as Error).message);
    await consumer.disconnect().catch(() => {});
    retry();
  }
}

export function startHubNode(): void {
  const beat = () => heartbeatLocalBots().catch((e) => console.warn('[HubNode] heartbeat:', e.message));
  void beat();
  setInterval(beat, HEARTBEAT_MS);
  void startTaskConsumer();
}
