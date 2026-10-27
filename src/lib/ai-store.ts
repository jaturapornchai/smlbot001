import fs from 'fs';
import path from 'path';
import { writeJsonAtomic, readJsonArray } from './json-file';
import { AIProviderConfig } from '@/types/ai';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROVIDERS_FILE = path.join(DATA_DIR, 'ai-providers.json');

const INITIAL_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'xai',
    name: 'xAI (Official API)',
    providerType: 'xai',
    baseUrl: 'https://api.x.ai/v1',
    apiKey: process.env.XAI_API_KEY || '',
    availableModels: ['grok-2', 'grok-2-mini', 'grok-beta', 'grok-vision-beta'],
    defaultModel: 'grok-2',
    isLocal: false,
    isActive: true,
    description: 'API ทางการของ xAI ตอบสนองเร็ว แม่นยำ ฉลาดในการวิเคราะห์เหตุผลและงานเชิงระบบ',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'deepseek',
    name: 'DeepSeek API',
    providerType: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    availableModels: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    isLocal: false,
    isActive: true,
    description: 'API จาก DeepSeek ฉลาด คุ้มค่า เหมาะกับงานเขียนโค้ดและงานวิเคราะห์ข้อมูลเชิงลึก',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'local-glm-88',
    name: 'Local GLM-5.2 Proxy (Private LAN)',
    providerType: 'local_proxy',
    baseUrl: process.env.LOCAL_GLM_URL || 'http://127.0.0.1:8077/v1',
    apiKey: '',
    availableModels: ['glm-5.2-think', 'glm-4'],
    defaultModel: 'glm-5.2-think',
    isLocal: true,
    isActive: true,
    description: 'พร็อกซี GLM-5.2 thinking ทำงานแบบ Private ภายในระบบ',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'local-kimi-88',
    name: 'Local Kimi K3 Proxy (Private LAN)',
    providerType: 'local_proxy',
    baseUrl: process.env.LOCAL_KIMI_URL || 'http://127.0.0.1:8078/v1',
    apiKey: '',
    availableModels: ['kimi-k3', 'moonshot-v1-8k'],
    defaultModel: 'kimi-k3',
    isLocal: true,
    isActive: true,
    description: 'พร็อกซี Kimi K3 reasoning ทำงานแบบ Private ภายในระบบ',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'openai',
    name: 'OpenAI API',
    providerType: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || '',
    availableModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'gpt-4-turbo'],
    defaultModel: 'gpt-4o-mini',
    isLocal: false,
    isActive: true,
    description: 'API ทางการจาก OpenAI มาตรฐานสากล รองรับทั้งโมเดลตอบเร็วและโมเดล Reasoning',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function ensureProvidersFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROVIDERS_FILE)) {
    writeJsonAtomic(PROVIDERS_FILE, INITIAL_PROVIDERS);
  }
}

export function getAllProviders(): AIProviderConfig[] {
  ensureProvidersFile();
  return readJsonArray<AIProviderConfig>(PROVIDERS_FILE, 'ai-providers.json');
}

const MASKED_KEY = '••••••••••••••••';

// ห้ามส่ง API Key / IP จริงออกไปหน้าจอ — ใช้กับทุก response ที่ส่งข้อมูล provider ให้ client
export const MASKED_HOST = 'core.local';

// เดิม regex เสีย (\b กลายเป็นอักขระ backspace, \d ตกหาย) → ไม่เคยซ่อน IP ได้จริง
export function maskBaseUrl(url: string): string {
  return url.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, MASKED_HOST);
}

export function maskProvider(p: AIProviderConfig) {
  return {
    ...p,
    apiKey: p.apiKey ? MASKED_KEY : '',
    hasKey: Boolean(p.apiKey),
    baseUrl: maskBaseUrl(p.baseUrl),
  };
}

export function getProviderById(id: string): AIProviderConfig | null {
  const providers = getAllProviders();
  return providers.find(p => p.id === id) || null;
}

export function createProvider(data: Omit<AIProviderConfig, 'id' | 'createdAt' | 'updatedAt'>): AIProviderConfig {
  const providers = getAllProviders();
  const newProvider: AIProviderConfig = {
    ...data,
    id: `provider-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  providers.push(newProvider);
  writeJsonAtomic(PROVIDERS_FILE, providers);
  return newProvider;
}

export function updateProvider(id: string, data: Partial<AIProviderConfig>): AIProviderConfig | null {
  const providers = getAllProviders();
  const index = providers.findIndex(p => p.id === id);
  if (index === -1) return null;

  const updated: AIProviderConfig = {
    ...providers[index],
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  };

  providers[index] = updated;
  writeJsonAtomic(PROVIDERS_FILE, providers);
  return updated;
}

export function deleteProvider(id: string): boolean {
  const providers = getAllProviders();
  const filtered = providers.filter(p => p.id !== id);
  if (filtered.length === providers.length) return false;

  writeJsonAtomic(PROVIDERS_FILE, filtered);
  return true;
}
