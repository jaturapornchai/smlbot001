import { NextResponse } from 'next/server';
import { getAllBots, createBot, updateBot } from '@/lib/bot-store';
import { getProviderById } from '@/lib/ai-store';
import { deployAgentZeroVM } from '@/lib/vm-orchestrator';
import { validateBotInput } from '@/lib/bot-input';

export async function GET() {
  try {
    const bots = getAllBots();
    return NextResponse.json({ success: true, data: bots });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const { data: input, error } = validateBotInput(body, false);
    if (!input) {
      return NextResponse.json({ success: false, error }, { status: 400 });
    }

    // สมองกลหลักเริ่มต้น = DeepSeek (ตามสถาปัตยกรรมจริง) ไม่ใช่ provider ที่ไม่มี key
    const providerId = input.providerId || 'deepseek';
    const newBot = createBot({
      name: input.name!,
      avatar: input.avatar || '🤖',
      role: input.role!,
      description: input.description || '',
      category: input.category || 'assistant',
      workMode: input.workMode || 'hybrid',
      status: input.status || 'active',
      autonomousEnabled: input.autonomousEnabled ?? true,
      autonomousIntervalMinutes: input.autonomousIntervalMinutes || 15,
      autonomousGoal: input.autonomousGoal || input.role || 'ปฏิบัติหน้าที่ตามบทบาทอย่างต่อเนื่อง 24/7',
      autoCloneEnabled: input.autoCloneEnabled ?? true,
      maxClones: input.maxClones ?? 3,
      clones: [],
      providerId,
      modelProvider: providerId,
      modelName: input.modelName || getProviderById(providerId)?.defaultModel || 'deepseek-chat',
      fallbackProviderId: input.fallbackProviderId,
      fallbackModelName: input.fallbackModelName || undefined,
      temperature: input.temperature ?? 0.7,
      maxTokens: input.maxTokens ?? 4096,
      systemPrompt: input.systemPrompt || 'คุณคือบอทผู้ช่วยอัจฉริยะ',
      tools: input.tools || [],
      triggerType: input.triggerType || 'manual',
      cronSchedule: input.cronSchedule || '',
      requireApproval: input.requireApproval ?? false,
    });

    // Deploy VM ทันทีบนเซิร์ฟเวอร์หลัก (Agent Zero 24/7) — ล้มเหลวก็ยังสร้างบอทได้ แต่แจ้งสาเหตุกลับไปให้เห็น
    let vmError: string | undefined;
    if (body?.deployVM !== false) try {
      const vmConfig = await deployAgentZeroVM(newBot);
      newBot.vmConfig = vmConfig;
      updateBot(newBot.id, { vmConfig, status: 'active' });
    } catch (vmErr: any) {
      vmError = vmErr.message;
      console.warn('Auto VM Deploy Notice:', vmErr.message);
    }

    return NextResponse.json({ success: true, data: newBot, vmError }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
