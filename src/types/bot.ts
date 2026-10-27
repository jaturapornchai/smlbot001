export type BotCategory = 'assistant' | 'analyst' | 'worker' | 'trading' | 'custom';
export type BotStatus = 'active' | 'idle' | 'paused' | 'error';
export type WorkMode = 'solo' | 'team' | 'hybrid'; // ทำงานเดี่ยว, ทำงานเป็นทีม, หรือทำได้ทั้งสองแบบ
export type ModelProvider = 'xai' | 'deepseek' | 'openai' | 'anthropic' | 'local_proxy';
export type TriggerType = 'manual' | 'schedule' | 'webhook' | 'event';

export interface BotStats {
  totalRuns: number;
  lastRunAt?: string;
  successRate: number;
}

export interface BotVMConfig {
  containerName: string;
  hostPort: number; // พอร์ตที่เปิดบนเซิร์ฟเวอร์หลัก เช่น 50001, 50002
  volumePath: string; // พาธเก็บข้อมูลบนโฮสต์ เช่น /home/smlsoft/smlbot/bots/<bot-id>/usr
  status: 'running' | 'stopped' | 'creating' | 'error';
  restartPolicy: 'unless-stopped' | 'always';
  memoryLimit?: string; // เช่น '1g', '2g'
  cpuLimit?: string; // เช่น '1.0', '2.0'
  uptime?: string;
  uiUrl?: string; // legacy: deploy ใหม่ไม่เก็บแล้ว (มี IP) หน้าเว็บประกอบลิงก์จาก hostname + hostPort เอง
}

export interface BotCloneInstance {
  id: string; // e.g. <bot-id>-clone-1
  cloneIndex: number;
  name: string;
  containerName: string;
  hostPort: number;
  status: 'idle' | 'busy' | 'running';
  currentTask?: string;
  createdAt: string;
}

export interface BotActivityLog {
  id: string;
  botId: string;
  botName: string;
  timestamp: string;
  actionType: 'autonomous_run' | 'self_heal' | 'clone_spawn' | 'failover' | 'user_directive' | 'task_complete';
  summary: string;
  details?: string;
  status: 'running' | 'success' | 'warning' | 'error';
}

export interface BotProperty {
  id: string;
  name: string;
  avatar: string;
  role: string;
  description: string;
  category: BotCategory;
  workMode: WorkMode; // รูปแบบการทำงาน: 'solo' (เดี่ยว) | 'team' (ทีม) | 'hybrid' (ทั้งสองอย่าง)
  status: BotStatus;
  
  // โหมด Autonomous 24/7 (ระบบทำงานอัตโนมัติ 100% คนแค่มาดูและปรับปรุงคำสั่ง)
  autonomousEnabled: boolean; // ทำงานวนรอบอัตโนมัติต่อเนื่อง
  autonomousIntervalMinutes: number; // รอบความถี่ (นาที) เช่น ทุก 5, 10, 15 นาที
  autonomousGoal: string; // เป้าหมายภารกิจที่ต้องทำอัตโนมัติต่อเนื่อง
  lastAutonomousRunAt?: string;
  nextAutonomousRunAt?: string;
  activityLogs?: BotActivityLog[]; // ประวัติกิจกรรมและการปฏิบัติภารกิจจริง

  // สถานะคิวงาน และการ Clone อัตโนมัติ (Dynamic Scaling)
  isBusy?: boolean;
  activeTask?: string;
  autoCloneEnabled: boolean; // เปิดใช้งานระบบ Clone ตัวเองอัตโนมัติเมื่อไม่ว่าง
  maxClones: number; // จำนวน Clone สูงสุด เช่น 3 หรือ 5 ตัว
  clones?: BotCloneInstance[]; // รายการ Clone VM ที่กำลังทำงานอยู่
  
  // Isolated VM / Container Configuration (Agent Zero 24/7)
  vmConfig?: BotVMConfig;
  
  // AI Brain & Model (สมองกลหลัก - Primary AI)
  providerId: string; // เชื่อมโยงกับ AIProviderConfig.id ในระบบ
  modelProvider?: string; // รองรับ backward compatibility
  modelName: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  
  // สมองกลสำรอง (Fallback / Backup AI) - สลับอัตโนมัติเมื่อตัวหลักล่ม/หมดโควต้า
  fallbackProviderId?: string;
  fallbackModelName?: string;
  
  // Tools & Skills
  tools: string[];
  
  // Automation & Trigger
  triggerType: TriggerType;
  cronSchedule?: string;
  requireApproval: boolean;
  
  // Metadata
  stats: BotStats;
  createdAt: string;
  updatedAt: string;
}

export interface BotMessage {
  id: string;
  groupId?: string; // ถ้าอยู่ในกลุ่ม ให้ระบุ groupId
  botId: string; // id ของบอท หรือ 'user'
  senderName: string;
  avatar: string;
  sender: 'user' | 'bot' | 'system';
  content: string;
  mentions?: string[]; // บอทที่ถูก @mention
  usedFallback?: boolean; // ระบุว่าข้อความนี้ใช้สมองกลสำรองตอบหรือไม่
  usedModel?: string; // ชื่อโมเดลที่ใช้ตอบจริง
  cloneInfo?: {
    isClone: boolean;
    cloneIndex: number;
    parentName: string;
  };
  timestamp: string;
  draftAction?: {
    type: string;
    title: string;
    details: string;
    approved?: boolean;
    dispatches?: Array<{ toBotId: string; task: string }>; // type = cross_province_dispatch
  };
  // ผลการส่งภารกิจข้ามจังหวัดเข้า Kafka (smlbot.tasks) จากคำตอบนี้
  dispatchResults?: Array<{ toBotId: string; toBotName: string; task: string; ok: boolean }>;
}

export type GroupCollaborationMode = 'sequential' | 'brainstorm' | 'mention_only';

export interface BotGroup {
  id: string;
  name: string;
  description: string;
  icon: string;
  leaderBotId: string; // บอทหัวหน้าทีมที่คอยประสานงานและสรุป
  memberBotIds: string[]; // สมาชิกบอทในกลุ่ม
  collaborationMode: GroupCollaborationMode; // โหมดการคุยกัน
  createdAt: string;
  updatedAt: string;
}

export interface MultiBotSession {
  id: string;
  title: string;
  botIds: string[];
  status: 'active' | 'completed';
  createdAt: string;
}

