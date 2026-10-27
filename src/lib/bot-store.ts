import fs from 'fs';
import path from 'path';
import { writeJsonAtomic, readJsonArray } from './json-file';
import { BotProperty, BotGroup } from '@/types/bot';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'bots.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');

const INITIAL_GROUPS: BotGroup[] = [
  {
    id: 'group-sme-leadership',
    name: 'ทีมบริหารธุรกิจ & บัญชีภาษี',
    description: 'กลุ่มบอทวิเคราะห์ธุรกิจ ประสานงานวางแผนกลยุทธ์ ตรวจสอบยอดขาย สต็อก และภาษีอย่างเป็นระบบ',
    icon: '🏢',
    leaderBotId: 'bot-sml-commander',
    memberBotIds: ['bot-sml-commander', 'bot-sme-sales-analyst', 'bot-account-tax-checker'],
    collaborationMode: 'sequential',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'group-infra-ops',
    name: 'ทีมดูแลระบบ & เซิร์ฟเวอร์',
    description: 'กลุ่มเฝ้าระวังเซิร์ฟเวอร์หลัก สแกนสถานะฐานข้อมูล Docker และแจ้งเตือนปัญหาแบบเรียลไทม์',
    icon: '🛡️',
    leaderBotId: 'bot-sml-commander',
    memberBotIds: ['bot-sml-commander', 'bot-server-sentinel'],
    collaborationMode: 'brainstorm',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_BOTS: BotProperty[] = [
  {
    id: 'bot-sml-commander',
    name: 'ผู้บัญชาการ SML (SML Commander)',
    avatar: '🧭',
    role: 'ผู้บัญชาการทีมและจัดสรรงานอัตโนมัติ',
    description: 'ศูนย์กลางการประสานงานของระบบ SML Bot วิเคราะห์คำสั่ง แตกย่อยภารกิจ สั่งการสมาชิกในทีม และสรุปรายงานรอบด้าน',
    category: 'assistant',
    workMode: 'hybrid',
    status: 'active',
    autonomousEnabled: true,
    autonomousIntervalMinutes: 10,
    autonomousGoal: 'ประสานงานและตรวจตราความพร้อมของทีมบอททุกตัว วางแผนงานประจำวัน และเตรียม Action Draft',
    autoCloneEnabled: true,
    maxClones: 3,
    clones: [],
    providerId: 'deepseek',
    modelProvider: 'deepseek',
    modelName: 'deepseek-chat',
    fallbackProviderId: 'local-glm-88',
    fallbackModelName: 'glm-5.2-think',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: 'คุณคือผู้บัญชาการทีมผู้ช่วยอัจฉริยะของระบบ SML Bot (SML Commander) ทำหน้าที่ประสานงาน วางแผนงาน แตก Task ย่อย และส่งต่องานให้บอทผู้เชี่ยวชาญตัวอื่น พร้อมตรวจทานผลลัพธ์และสรุปรายงานให้ลุงจืดอย่างกระชับ ชัดเจน',
    tools: ['web_search', 'task_dispatch', 'calc'],
    triggerType: 'manual',
    requireApproval: true,
    stats: {
      totalRuns: 142,
      lastRunAt: new Date(Date.now() - 3600000).toISOString(),
      successRate: 98.6,
    },
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bot-sme-sales-analyst',
    name: 'นักวิเคราะห์ยอดขาย & สต็อก',
    avatar: '📊',
    role: 'วิเคราะห์เทรนด์สินค้า ยอดขายคงคลัง และแจ้งเตือนของขาด',
    description: 'เชื่อมต่อฐานข้อมูล ตรวจสอบยอดขาย สินค้าขายดี และคำนวณรอบการสั่งซื้อล่วงหน้า',
    category: 'analyst',
    workMode: 'team',
    status: 'active',
    autonomousEnabled: true,
    autonomousIntervalMinutes: 15,
    autonomousGoal: 'วิเคราะห์ยอดขายและสต็อกสินค้าคงเหลือ คำนวณจุดสั่งซื้อใหม่ (Reorder Point) และเฝ้าระวังของขาด',
    autoCloneEnabled: true,
    maxClones: 3,
    clones: [],
    providerId: 'deepseek',
    modelProvider: 'deepseek',
    modelName: 'deepseek-chat',
    fallbackProviderId: 'local-glm-88',
    fallbackModelName: 'glm-5.2-think',
    temperature: 0.2,
    maxTokens: 4096,
    systemPrompt: 'คุณคือนักวิเคราะห์ข้อมูล SME และค้าปลีก-ส่ง วิเคราะห์ข้อมูลตัวเลขทางธุรกิจอย่างแม่นยำ อิงตามมาตรฐานบัญชีและตัวเลขจริง ห้ามประมาณการโดยไม่มีข้อมูลรองรับ',
    tools: ['sql_query', 'calc', 'chart_generator'],
    triggerType: 'schedule',
    cronSchedule: '0 8 * * *',
    requireApproval: false,
    stats: {
      totalRuns: 89,
      lastRunAt: new Date(Date.now() - 7200000).toISOString(),
      successRate: 100,
    },
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bot-account-tax-checker',
    name: 'ผู้ช่วยตรวจเอกสารบัญชี & ภาษี',
    avatar: '📑',
    role: 'ตรวจสอบความถูกต้องใบกำกับภาษี VAT และเอกสารหัก ณ ที่จ่าย',
    description: 'ตรวจสอบความถูกต้องของเลขประจำตัวผู้เสียภาษี 13 หลัก, ยอด VAT 7%, หัก ณ ที่จ่าย ภ.ง.ด.',
    category: 'assistant',
    workMode: 'hybrid',
    status: 'active',
    autonomousEnabled: true,
    autonomousIntervalMinutes: 20,
    autonomousGoal: 'ตรวจสอบความถูกต้องของรายการภาษี VAT 7% และหัก ณ ที่จ่าย ภ.ง.ด. ไม่ให้มีข้อผิดพลาด',
    autoCloneEnabled: true,
    maxClones: 3,
    clones: [],
    providerId: 'local-glm-88',
    modelProvider: 'local_proxy',
    modelName: 'glm-5.2-think',
    fallbackProviderId: 'deepseek',
    fallbackModelName: 'deepseek-chat',
    temperature: 0.1,
    maxTokens: 8192,
    systemPrompt: 'คุณคือผู้เชี่ยวชาญการตรวจเอกสารบัญชีและภาษีไทย ตรวจสอบเอกสารตามประมวลรัษฎากรอย่างเคร่งครัด คำนวณยอดเงินทศนิยม 2 ตำแหน่งถูกต้อง ไม่ปัดเศษซ้ำซ้อน',
    tools: ['tax_verifier', 'calc'],
    triggerType: 'manual',
    requireApproval: true,
    stats: {
      totalRuns: 65,
      lastRunAt: new Date(Date.now() - 14400000).toISOString(),
      successRate: 99.2,
    },
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bot-server-sentinel',
    name: 'บอทเฝ้าระวังเซิร์ฟเวอร์หลัก (System Sentinel)',
    avatar: '🛡️',
    role: 'ตรวจสถานะเซิร์ฟเวอร์, Docker, DB และพอร์ตสำคัญ',
    description: 'ตรวจสอบ Health check ของ PostgreSQL, MongoDB, Redis, ClickHouse, Redpanda บนเครื่องเซิร์ฟเวอร์หลัก',
    category: 'worker',
    workMode: 'solo',
    status: 'active',
    autonomousEnabled: true,
    autonomousIntervalMinutes: 5,
    autonomousGoal: 'เฝ้าระวังสถานะเซิร์ฟเวอร์หลัก, Docker Containers และตรวจสอบความพร้อมของระบบฐานข้อมูล',
    autoCloneEnabled: true,
    maxClones: 3,
    clones: [],
    providerId: 'local-kimi-88',
    modelProvider: 'local_proxy',
    modelName: 'kimi-k3',
    fallbackProviderId: 'local-glm-88',
    fallbackModelName: 'glm-5.2-think',
    temperature: 0.1,
    maxTokens: 2048,
    systemPrompt: 'คุณคือบอทวิศวกรระบบ (System Sentinel) คอยเฝ้าระวังและแจ้งเตือนความผิดปกติของเซิร์ฟเวอร์ Linux และ Docker Containers',
    tools: ['server_ping', 'http_request'],
    triggerType: 'schedule',
    cronSchedule: '*/15 * * * *',
    requireApproval: false,
    stats: {
      totalRuns: 288,
      lastRunAt: new Date(Date.now() - 900000).toISOString(),
      successRate: 100,
    },
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    writeJsonAtomic(DATA_FILE, INITIAL_BOTS);
  }
  if (!fs.existsSync(GROUPS_FILE)) {
    writeJsonAtomic(GROUPS_FILE, INITIAL_GROUPS);
  }
}

export function getAllGroups(): BotGroup[] {
  ensureDataFile();
  return readJsonArray<BotGroup>(GROUPS_FILE, 'groups.json');
}

export function getGroupById(id: string): BotGroup | null {
  const groups = getAllGroups();
  return groups.find(g => g.id === id) || null;
}

export function createGroup(data: Omit<BotGroup, 'id' | 'createdAt' | 'updatedAt'>): BotGroup {
  const groups = getAllGroups();
  const newGroup: BotGroup = {
    ...data,
    id: `group-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  groups.unshift(newGroup);
  writeJsonAtomic(GROUPS_FILE, groups);
  return newGroup;
}

export function updateGroup(id: string, data: Partial<BotGroup>): BotGroup | null {
  const groups = getAllGroups();
  const index = groups.findIndex(g => g.id === id);
  if (index === -1) return null;

  const updated: BotGroup = {
    ...groups[index],
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  };

  groups[index] = updated;
  writeJsonAtomic(GROUPS_FILE, groups);
  return updated;
}

export function deleteGroup(id: string): boolean {
  const groups = getAllGroups();
  const filtered = groups.filter(g => g.id !== id);
  if (filtered.length === groups.length) return false;

  writeJsonAtomic(GROUPS_FILE, filtered);
  return true;
}

export function getAllBots(): BotProperty[] {
  ensureDataFile();
  return readJsonArray<BotProperty>(DATA_FILE, 'bots.json');
}

export function getBotById(id: string): BotProperty | null {
  const bots = getAllBots();
  return bots.find(b => b.id === id) || null;
}

export function createBot(data: Omit<BotProperty, 'id' | 'createdAt' | 'updatedAt' | 'stats'>): BotProperty {
  const bots = getAllBots();
  const newBot: BotProperty = {
    ...data,
    id: `bot-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    stats: {
      totalRuns: 0,
      successRate: 100,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  bots.unshift(newBot);
  writeJsonAtomic(DATA_FILE, bots);
  return newBot;
}

export function updateBot(id: string, data: Partial<BotProperty>): BotProperty | null {
  const bots = getAllBots();
  const index = bots.findIndex(b => b.id === id);
  if (index === -1) return null;

  const updated: BotProperty = {
    ...bots[index],
    ...data,
    id, // protect id
    updatedAt: new Date().toISOString(),
  };

  bots[index] = updated;
  writeJsonAtomic(DATA_FILE, bots);
  return updated;
}

export function deleteBot(id: string): boolean {
  const bots = getAllBots();
  const filtered = bots.filter(b => b.id !== id);
  if (filtered.length === bots.length) return false;

  writeJsonAtomic(DATA_FILE, filtered);
  return true;
}

export function toggleBotStatus(id: string): BotProperty | null {
  const bot = getBotById(id);
  if (!bot) return null;

  const nextStatus = bot.status === 'active' ? 'paused' : 'active';
  return updateBot(id, { status: nextStatus });
}
