import { getProviderById, getAllProviders } from './ai-store';
import { AICallRequest, AICallResponse } from '@/types/ai';

// Provider ที่เพิ่งล้มเหลว: Tier 3 ข้ามไปก่อน 60 วิ — ตอน AI ล่มพร้อมกันหลายตัว ไม่ต้องรอ timeout 45 วิ ทีละตัวทุกคำขอ
const FAILURE_COOLDOWN_MS = 60_000;
const failedAt = new Map<string, number>();
const isCoolingDown = (providerId: string) => Date.now() - (failedAt.get(providerId) || 0) < FAILURE_COOLDOWN_MS;

export async function callAIModel(request: AICallRequest): Promise<AICallResponse> {
  const startTime = Date.now();
  const provider = getProviderById(request.providerId);
  if (!provider) {
    throw new Error(`ไม่พบ AI Provider ที่ระบุ: ${request.providerId}`);
  }

  if (!provider.isActive) {
    throw new Error(`AI Provider ${provider.name} ถูกปิดใช้งานอยู่ในระบบ`);
  }

  // เตรียม Messages สำหรับ Chat Completion
  const messages = [];
  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }
  messages.push(...request.messages);

  const endpoint = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  const payload = {
    model: request.modelName || provider.defaultModel,
    messages,
    temperature: typeof request.temperature === 'number' ? request.temperature : 0.7,
    max_tokens: request.maxTokens || 4096,
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      // timeout 45s
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`AI API error (${res.status}): ${(errText || res.statusText).slice(0, 300)}`);
    }

    const data = await res.json();
    const durationMs = Date.now() - startTime;
    const choice = data.choices?.[0];
    const content = choice?.message?.content || choice?.text || '';
    // คำตอบว่าง = ใช้งานไม่ได้ ต้องโยน error ให้ cascade ไปหาตัวถัดไป (เดิมส่งข้อความว่างกลับไปเงียบ ๆ)
    if (!String(content).trim()) throw new Error('AI ตอบกลับว่างเปล่า');
    // ดู token ที่ใช้จริงได้จาก log — DeepSeek แยก prompt_cache_hit_tokens (ส่วนที่คิดราคา cache ~2%)
    const u = data.usage;
    if (u) console.info(`[AI Usage] ${provider.name} ${payload.model}: in ${u.prompt_tokens ?? '-'} (cache ${u.prompt_cache_hit_tokens ?? '-'}) out ${u.completion_tokens ?? '-'}`);

    return {
      content,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
      } : undefined,
      model: data.model || request.modelName,
      durationMs,
    };
  } catch (error: any) {
    failedAt.set(provider.id, Date.now());
    throw new Error(`เรียกใช้งาน AI (${provider.name} - ${request.modelName}) ล้มเหลว: ${error.message}`);
  }
}

export interface CascadeCallParams {
  botName?: string;
  primaryProviderId: string;
  primaryModelName?: string;
  fallbackProviderId?: string;
  fallbackModelName?: string;
  systemPrompt?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface CascadeCallResult {
  content: string;
  usedProviderId: string;
  usedProviderName: string;
  usedModel: string;
  isFallback: boolean;
  fallbackTier: 1 | 2 | 3;
  failoverChain: Array<{ providerId: string; modelName?: string; error: string }>;
  notice?: string;
}

/**
 * Multi-Tier Dynamic Failover & Auto-Discovery
 * กฎ: "ถ้า AI สำรองไม่ทำงาน ให้หาตัวที่ทำงานได้มาทำแทน"
 * 1. Tier 1: Primary AI
 * 2. Tier 2: Configured Backup / Fallback AI
 * 3. Tier 3: Auto-Discovery ค้นหาและลองใช้ Provider อื่นในระบบทั้งหมดจนกว่าจะเจอตัวที่ทำงานได้
 */
export async function callAIWithCascadeFallback(params: CascadeCallParams): Promise<CascadeCallResult> {
  const failoverChain: Array<{ providerId: string; modelName?: string; error: string }> = [];
  const triedProviders = new Set<string>();

  // --------------------------------------------------------------------------
  // Tier 1: สมองกลหลัก (Primary AI)
  // --------------------------------------------------------------------------
  try {
    triedProviders.add(params.primaryProviderId);
    const primaryProv = getProviderById(params.primaryProviderId);
    const modelToUse = params.primaryModelName || primaryProv?.defaultModel || 'default';

    const res = await callAIModel({
      providerId: params.primaryProviderId,
      modelName: modelToUse,
      systemPrompt: params.systemPrompt,
      messages: params.messages,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });

    return {
      content: res.content,
      usedProviderId: params.primaryProviderId,
      usedProviderName: primaryProv?.name || params.primaryProviderId,
      usedModel: res.model || modelToUse,
      isFallback: false,
      fallbackTier: 1,
      failoverChain: [],
    };
  } catch (err: any) {
    failoverChain.push({
      providerId: params.primaryProviderId,
      modelName: params.primaryModelName,
      error: err.message,
    });
    console.warn(`[Tier 1 Failover] Primary AI failed for ${params.botName || 'Bot'}:`, err.message);
  }

  // --------------------------------------------------------------------------
  // Tier 2: สมองกลสำรองตามที่กำหนด (Configured Fallback AI)
  // --------------------------------------------------------------------------
  if (params.fallbackProviderId && !triedProviders.has(params.fallbackProviderId)) {
    try {
      triedProviders.add(params.fallbackProviderId);
      const fallbackProv = getProviderById(params.fallbackProviderId);
      const modelToUse = params.fallbackModelName || fallbackProv?.defaultModel || 'default';

      const res = await callAIModel({
        providerId: params.fallbackProviderId,
        modelName: modelToUse,
        systemPrompt: params.systemPrompt,
        messages: params.messages,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
      });

      return {
        content: res.content,
        usedProviderId: params.fallbackProviderId,
        usedProviderName: fallbackProv?.name || params.fallbackProviderId,
        usedModel: res.model || modelToUse,
        isFallback: true,
        fallbackTier: 2,
        failoverChain,
        notice: `สลับใช้สมองกลสำรอง (${fallbackProv?.name || params.fallbackProviderId} - ${modelToUse})`,
      };
    } catch (err: any) {
      failoverChain.push({
        providerId: params.fallbackProviderId,
        modelName: params.fallbackModelName,
        error: err.message,
      });
      console.warn(`[Tier 2 Failover] Backup AI failed for ${params.botName || 'Bot'}:`, err.message);
    }
  }

  // --------------------------------------------------------------------------
  // Tier 3: Auto-Discovery "หาตัวที่ทำงานได้มาทำแทน" (Cascade Search)
  // --------------------------------------------------------------------------
  // Cloud ที่ไม่มี API Key ยิงไปก็ได้ 401 แน่นอน → ไม่นับเป็นตัวเลือก
  const allProviders = getAllProviders().filter((p) => p.isActive && (p.isLocal || p.apiKey));

  // เรียงลำดับ: Provider ที่มี apiKey (เช่น DeepSeek) หรือ Cloud API ที่เปิดอยู่ก่อน Local Proxy ที่อาจยังไม่รัน
  const candidates = allProviders
    .filter((p) => !triedProviders.has(p.id))
    .sort((a, b) => {
      const aScore = (a.apiKey ? 2 : 0) + (a.isLocal ? 0 : 1);
      const bScore = (b.apiKey ? 2 : 0) + (b.isLocal ? 0 : 1);
      return bScore - aScore;
    });

  for (const candidate of candidates) {
    triedProviders.add(candidate.id);
    const candidateModel = candidate.defaultModel || candidate.availableModels[0];
    if (isCoolingDown(candidate.id)) {
      failoverChain.push({ providerId: candidate.id, modelName: candidateModel, error: 'ข้าม: เพิ่งล้มเหลวภายใน 60 วินาที' });
      continue;
    }

    try {
      console.info(`[Tier 3 Auto-Discovery] Trying working AI replacement: ${candidate.name} (${candidateModel})`);
      const res = await callAIModel({
        providerId: candidate.id,
        modelName: candidateModel,
        systemPrompt: params.systemPrompt,
        messages: params.messages,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
      });

      return {
        content: res.content,
        usedProviderId: candidate.id,
        usedProviderName: candidate.name,
        usedModel: res.model || candidateModel,
        isFallback: true,
        fallbackTier: 3,
        failoverChain,
        notice: `ระบบสลับมาใช้ ${candidate.name} (${candidateModel}) อัตโนมัติ เนื่องจาก AI สำรองไม่ตอบสนอง`,
      };
    } catch (err: any) {
      failoverChain.push({
        providerId: candidate.id,
        modelName: candidateModel,
        error: err.message,
      });
      console.warn(`[Tier 3 Auto-Discovery] Candidate ${candidate.name} also failed:`, err.message);
    }
  }

  // หากลองทุกตัวในระบบแล้วไม่สำเร็จจริง ๆ
  const chainSummary = failoverChain.map((f) => `• ${f.providerId}: ${f.error}`).join('\n');
  throw new Error(`ไม่พบ AI ตัวใดในระบบที่พร้อมทำงาน (ลองทั้งหมด ${failoverChain.length} ตัว):\n${chainSummary}`);
}
