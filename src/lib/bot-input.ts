import { BotProperty, BotGroup } from '@/types/bot';
import { AIProviderConfig } from '@/types/ai';
import { getProviderById } from './ai-store';
import { getBotById } from './bot-store';

// ตรวจ input จาก client ก่อนเขียนลง JSON store: กัน mass-assignment (vmConfig/clones/stats/id)
// และค่าที่ทำให้ระบบรวน เช่น maxClones 1000 = สั่ง docker run 1000 ตัว หรือรอบ Autonomous ติดลบ = ยิง AI ทุก tick
type Result<T> = { data?: T; error?: string };
type Body = Record<string, unknown>;

class InputError extends Error {}

function text(body: Body, key: string, label: string, max: number, required = false): string | undefined {
  const v = body[key];
  if (v === undefined || v === null) {
    if (required) throw new InputError(`กรุณากรอก${label}`);
    return undefined;
  }
  if (typeof v !== 'string') throw new InputError(`${label} ต้องเป็นข้อความ`);
  const s = v.trim();
  if (required && !s) throw new InputError(`กรุณากรอก${label}`);
  if (s.length > max) throw new InputError(`${label} ยาวเกิน ${max} ตัวอักษร`);
  return s;
}

function num(body: Body, key: string, label: string, min: number, max: number, integer = false): number | undefined {
  const v = body[key];
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || (integer && !Number.isInteger(n)) || n < min || n > max) {
    throw new InputError(`${label} ต้องเป็น${integer ? 'จำนวนเต็ม' : 'ตัวเลข'}ระหว่าง ${min}-${max}`);
  }
  return n;
}

function bool(body: Body, key: string): boolean | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'boolean') throw new InputError(`${key} ต้องเป็น true/false`);
  return v;
}

function oneOf<T extends string>(body: Body, key: string, label: string, allowed: readonly T[]): T | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  if (!allowed.includes(v as T)) throw new InputError(`${label} ไม่ถูกต้อง (ใช้ได้: ${allowed.join(', ')})`);
  return v as T;
}

function stringList(body: Body, key: string, label: string, maxItems: number): string[] | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v) || v.length > maxItems || v.some((x) => typeof x !== 'string' || x.length > 100)) {
    throw new InputError(`${label} ต้องเป็นรายการข้อความไม่เกิน ${maxItems} รายการ`);
  }
  return v.map((x) => x.trim()).filter(Boolean);
}

function existingProvider(id: string | undefined, label: string): string | undefined {
  if (id && !getProviderById(id)) throw new InputError(`ไม่พบ${label}: ${id}`);
  return id;
}

function run<T>(body: unknown, build: (b: Body) => T): Result<T> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'รูปแบบข้อมูลไม่ถูกต้อง' };
  try {
    return { data: build(body as Body) };
  } catch (e) {
    if (e instanceof InputError) return { error: e.message };
    throw e;
  }
}

// ลบ key ที่เป็น undefined ทิ้ง เพื่อไม่ให้ partial update ไปล้างค่าเดิมโดยไม่ตั้งใจ
function defined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export type BotInput = Partial<
  Pick<
    BotProperty,
    | 'name' | 'role' | 'avatar' | 'description' | 'category' | 'workMode' | 'status'
    | 'autonomousEnabled' | 'autonomousIntervalMinutes' | 'autonomousGoal'
    | 'autoCloneEnabled' | 'maxClones' | 'providerId' | 'modelName'
    | 'fallbackProviderId' | 'fallbackModelName' | 'temperature' | 'maxTokens'
    | 'systemPrompt' | 'tools' | 'triggerType' | 'cronSchedule' | 'requireApproval'
    | 'isBusy' | 'activeTask'
  >
>;

/** partial=true สำหรับ PUT (แก้บางช่อง), false สำหรับสร้างใหม่ (ชื่อ+บทบาทบังคับ) */
export function validateBotInput(body: unknown, partial: boolean): Result<BotInput> {
  return run(body, (b) => {
    const out: BotInput = defined({
      name: text(b, 'name', 'ชื่อ Bot', 80, !partial),
      role: text(b, 'role', 'บทบาทหน้าที่', 120, !partial),
      avatar: text(b, 'avatar', 'ไอคอน', 8),
      description: text(b, 'description', 'คำอธิบาย', 1000),
      category: oneOf(b, 'category', 'หมวดหมู่', ['assistant', 'analyst', 'worker', 'trading', 'custom'] as const),
      workMode: oneOf(b, 'workMode', 'รูปแบบงาน', ['solo', 'team', 'hybrid'] as const),
      status: oneOf(b, 'status', 'สถานะ', ['active', 'idle', 'paused', 'error'] as const),
      autonomousEnabled: bool(b, 'autonomousEnabled'),
      autonomousIntervalMinutes: num(b, 'autonomousIntervalMinutes', 'ความถี่รอบ (นาที)', 1, 1440, true),
      autonomousGoal: text(b, 'autonomousGoal', 'เป้าหมายภารกิจ', 1000),
      autoCloneEnabled: bool(b, 'autoCloneEnabled'),
      maxClones: num(b, 'maxClones', 'จำนวน Clone สูงสุด', 0, 10, true),
      providerId: existingProvider(text(b, 'providerId', 'สมองกลหลัก', 100) || undefined, 'สมองกลหลัก'),
      modelName: text(b, 'modelName', 'ชื่อโมเดลหลัก', 100) || undefined,
      fallbackModelName: text(b, 'fallbackModelName', 'ชื่อโมเดลสำรอง', 100),
      temperature: num(b, 'temperature', 'Temperature', 0, 2),
      maxTokens: num(b, 'maxTokens', 'Max Tokens', 1, 65536, true),
      systemPrompt: text(b, 'systemPrompt', 'System Prompt', 8000),
      tools: stringList(b, 'tools', 'Tools', 50),
      triggerType: oneOf(b, 'triggerType', 'Trigger', ['manual', 'schedule', 'webhook', 'event'] as const),
      cronSchedule: text(b, 'cronSchedule', 'Cron', 100),
      requireApproval: bool(b, 'requireApproval'),
      isBusy: partial ? bool(b, 'isBusy') : undefined,
      activeTask: partial ? text(b, 'activeTask', 'งานที่ทำอยู่', 120) : undefined,
    });

    // fallbackProviderId: '' = ปิดสมองกลสำรอง → ต้องตั้งเป็น undefined จริง ๆ เพื่อล้างค่าเดิม
    if ('fallbackProviderId' in b) {
      const fb = text(b, 'fallbackProviderId', 'สมองกลสำรอง', 100) || undefined;
      out.fallbackProviderId = existingProvider(fb, 'สมองกลสำรอง');
      if (!fb) out.fallbackModelName = undefined;
    }
    if (out.isBusy === false) out.activeTask = undefined;
    return out;
  });
}

export type ProviderInput = Partial<
  Pick<
    AIProviderConfig,
    'name' | 'providerType' | 'baseUrl' | 'apiKey' | 'availableModels' | 'defaultModel' | 'isLocal' | 'isActive' | 'description'
  >
>;

export function validateProviderInput(body: unknown, partial: boolean): Result<ProviderInput> {
  return run(body, (b) => {
    const baseUrl = text(b, 'baseUrl', 'Base URL', 300, !partial);
    if (baseUrl) {
      let u: URL;
      try {
        u = new URL(baseUrl);
      } catch {
        throw new InputError('Base URL ไม่ถูกต้อง (ตัวอย่าง: https://api.deepseek.com/v1)');
      }
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new InputError('Base URL ต้องขึ้นต้นด้วย http:// หรือ https://');
    }
    return defined({
      name: text(b, 'name', 'ชื่อ Provider', 80, !partial),
      providerType: oneOf(b, 'providerType', 'ประเภท Provider', [
        'xai', 'deepseek', 'openai', 'anthropic', 'gemini', 'local_proxy', 'custom_openai',
      ] as const),
      baseUrl,
      apiKey: text(b, 'apiKey', 'API Key', 500),
      availableModels: stringList(b, 'availableModels', 'รายชื่อโมเดล', 50),
      defaultModel: text(b, 'defaultModel', 'โมเดลเริ่มต้น', 100),
      isLocal: bool(b, 'isLocal'),
      isActive: bool(b, 'isActive'),
      description: text(b, 'description', 'คำอธิบาย', 500),
    });
  });
}

export type GroupInput = Omit<BotGroup, 'id' | 'createdAt' | 'updatedAt'>;

export function validateGroupInput(body: unknown): Result<GroupInput> {
  return run(body, (b) => {
    const leaderBotId = text(b, 'leaderBotId', 'หัวหน้าทีม', 100, true)!;
    if (!getBotById(leaderBotId)) throw new InputError(`ไม่พบบอทหัวหน้าทีม: ${leaderBotId}`);
    const members = stringList(b, 'memberBotIds', 'สมาชิก', 20) || [];
    const missing = members.filter((id) => !getBotById(id));
    if (missing.length) throw new InputError(`ไม่พบบอทสมาชิก: ${missing.join(', ')}`);

    return {
      name: text(b, 'name', 'ชื่อกลุ่ม', 80, true)!,
      description: text(b, 'description', 'คำอธิบาย', 500) || '',
      icon: text(b, 'icon', 'ไอคอน', 8) || '👥',
      leaderBotId,
      // หัวหน้าต้องอยู่ในสมาชิกเสมอ ไม่งั้นห้องทีมแสดงจำนวนสมาชิกไม่ตรงกับคนที่ทำงานจริง
      memberBotIds: Array.from(new Set([leaderBotId, ...members])),
      collaborationMode: oneOf(b, 'collaborationMode', 'โหมดทีม', ['sequential', 'brainstorm', 'mention_only'] as const) || 'sequential',
    };
  });
}

/** ข้อความแชท: กัน message ไม่ใช่ string / history ยาวไม่จำกัดจนเกิน context ของโมเดล */
export function validateChatInput(body: unknown): Result<{ message: string; history: Array<{ sender: string; content: string }> }> {
  return run(body, (b) => {
    const message = text(b, 'message', 'ข้อความ', 8000, true)!;
    const raw = Array.isArray(b.history) ? b.history : [];
    const history = raw
      .filter((h): h is { sender: string; content: string } =>
        !!h && typeof h === 'object' && typeof (h as any).content === 'string' && typeof (h as any).sender === 'string')
      .filter((h) => h.sender !== 'system')
      .slice(-20)
      .map((h) => ({ sender: h.sender, content: h.content.slice(0, 8000) }));
    return { message, history };
  });
}
