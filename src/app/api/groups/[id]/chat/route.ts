import { NextResponse } from 'next/server';
import { getGroupById, getBotById } from '@/lib/bot-store';
import { callAIWithCascadeFallback } from '@/lib/ai-gateway';
import { BotMessage } from '@/types/bot';
import { validateChatInput } from '@/lib/bot-input';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const group = getGroupById(id);
    if (!group) {
      return NextResponse.json({ success: false, error: 'ไม่พบกลุ่มที่ระบุ' }, { status: 404 });
    }

    // message ไม่ใช่ string เดิมพังด้วย .trim is not a function → 500
    const { data: input, error: inputError } = validateChatInput(await request.json().catch(() => null));
    if (!input) {
      return NextResponse.json({ success: false, error: inputError }, { status: 400 });
    }
    const userPrompt = input.message;

    const memberBots = group.memberBotIds
      .map(botId => getBotById(botId))
      .filter((b): b is NonNullable<typeof b> => Boolean(b)); // บอทที่ถูกลบไปแล้ว = undefined

    if (memberBots.length === 0) {
      return NextResponse.json({ success: false, error: 'กลุ่มนี้ยังไม่มีสมาชิก Bot' }, { status: 400 });
    }

    const leaderBot = getBotById(group.leaderBotId) || memberBots[0];
    const responses: BotMessage[] = [];

    // 1. Leader Bot วิเคราะห์โจทย์และสั่งการสมาชิกในทีม (Real AI Call with Cascade Fallback)
    const leaderSystemPrompt = `${leaderBot.systemPrompt}
คุณคือหัวหน้ากลุ่ม "${group.name}"
สมาชิกในทีมได้แก่: ${memberBots.map((b) => `${b.name} (บทบาท: ${b.role})`).join(', ')}
เมื่อได้รับงานจากลุงจืด ให้คุณวิเคราะห์เป้าหมาย แจกแจงภารกิจ และสั่งการสมาชิกในทีมที่เหมาะสมเพื่อร่วมกันทำงานให้สำเร็จ ตอบภาษาไทย สั้น ตรงประเด็น`;

    let leaderReply = '';
    try {
      const leaderResult = await callAIWithCascadeFallback({
        botName: leaderBot.name,
        primaryProviderId: leaderBot.providerId,
        primaryModelName: leaderBot.modelName,
        fallbackProviderId: leaderBot.fallbackProviderId,
        fallbackModelName: leaderBot.fallbackModelName,
        temperature: leaderBot.temperature,
        maxTokens: 1024,
        systemPrompt: leaderSystemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      leaderReply = leaderResult.content;
      responses.push({
        id: `msg-${Date.now()}-leader`,
        groupId: group.id,
        botId: leaderBot.id,
        senderName: leaderBot.name,
        avatar: leaderBot.avatar,
        sender: 'bot',
        content: leaderReply,
        usedFallback: leaderResult.isFallback,
        usedModel: leaderResult.usedModel,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      responses.push({
        id: `msg-${Date.now()}-leader-err`,
        groupId: group.id,
        botId: leaderBot.id,
        senderName: leaderBot.name,
        avatar: leaderBot.avatar,
        sender: 'bot',
        content: `[หัวหน้าทีม]: ไม่สามารถเรียก AI ตัวใดในระบบได้: ${err.message}`,
        timestamp: new Date().toISOString(),
      });
    }

    // 2. สมาชิกผู้เชี่ยวชาญในทีมร่วมตอบสนองตามบทบาทจริง (Real AI Calls with Cascade Fallback)
    const specialists = memberBots.filter((b) => b.id !== leaderBot.id);
    let lastSpecialistReply = '';

    for (let i = 0; i < Math.min(specialists.length, 2); i++) {
      const specialist = specialists[i];
      const specialistSystemPrompt = `${specialist.systemPrompt}
คุณคือ ${specialist.name} บทบาทคือ "${specialist.role}" อยู่ในทีม "${group.name}"
หัวหน้าทีม (${leaderBot.name}) สั่งการในโจทย์ของลุงจืดดังนี้:
"${leaderReply.slice(0, 500)}"
ในฐานะผู้เชี่ยวชาญด้าน ${specialist.role} จงให้ข้อมูล การวิเคราะห์ หรือขั้นตอนที่ต้องทำในส่วนของคุณอย่างเฉียบคม ตอบภาษาไทย สั้น ชัดเจน`;

      try {
        const specResult = await callAIWithCascadeFallback({
          botName: specialist.name,
          primaryProviderId: specialist.providerId,
          primaryModelName: specialist.modelName,
          fallbackProviderId: specialist.fallbackProviderId,
          fallbackModelName: specialist.fallbackModelName,
          temperature: specialist.temperature,
          maxTokens: 1024,
          systemPrompt: specialistSystemPrompt,
          messages: [{ role: 'user', content: `ภารกิจจากหัวหน้า: ${leaderReply.slice(0, 400)}` }],
        });

        lastSpecialistReply = specResult.content;
        responses.push({
          id: `msg-${Date.now()}-spec-${i}`,
          groupId: group.id,
          botId: specialist.id,
          senderName: specialist.name,
          avatar: specialist.avatar,
          sender: 'bot',
          content: specResult.content,
          usedFallback: specResult.isFallback,
          usedModel: specResult.usedModel,
          timestamp: new Date(Date.now() + 500 * (i + 1)).toISOString(),
        });
      } catch (specErr: any) {
        responses.push({
          id: `msg-${Date.now()}-spec-${i}-err`,
          groupId: group.id,
          botId: specialist.id,
          senderName: specialist.name,
          avatar: specialist.avatar,
          sender: 'bot',
          content: `[${specialist.name}]: เกิดข้อผิดพลาดในการเรียก AI ทุกตัวในระบบ: ${specErr.message}`,
          timestamp: new Date(Date.now() + 500 * (i + 1)).toISOString(),
        });
      }
    }

    // 3. Leader สรุปผลภาพรวมและเตรียม Action Draft จริง
    if (specialists.length > 0 && lastSpecialistReply) {
      const summaryPrompt = `${leaderBot.systemPrompt}
คุณคือหัวหน้าทีม "${group.name}"
สรุปผลการทำงานร่วมกันของทีมจากข้อมูลที่สมาชิกตอบกลับ:
"${lastSpecialistReply.slice(0, 500)}"
จงสรุปข้อสรุปสุดท้ายสำหรับลุงจืดสั้นๆ 1-3 บรรทัด และแจ้งความพร้อมในการลงมือทำ`;

      try {
        const summaryResult = await callAIWithCascadeFallback({
          botName: leaderBot.name,
          primaryProviderId: leaderBot.providerId,
          primaryModelName: leaderBot.modelName,
          fallbackProviderId: leaderBot.fallbackProviderId,
          fallbackModelName: leaderBot.fallbackModelName,
          temperature: leaderBot.temperature,
          maxTokens: 512,
          systemPrompt: summaryPrompt,
          messages: [{ role: 'user', content: 'ขอสรุปแนวทางปฏิบัติการสุดท้ายของทีม' }],
        });

        responses.push({
          id: `msg-${Date.now()}-summary`,
          groupId: group.id,
          botId: leaderBot.id,
          senderName: leaderBot.name,
          avatar: leaderBot.avatar,
          sender: 'bot',
          content: summaryResult.content,
          usedFallback: summaryResult.isFallback,
          usedModel: summaryResult.usedModel,
          timestamp: new Date(Date.now() + 1500).toISOString(),
          draftAction: {
            type: 'confirm_execution',
            title: `อนุมัติแผนงานทีม: ${userPrompt.slice(0, 35)}`,
            details: `มอบหมายให้ ${specialists.map(s => s.name).join(', ')} ดำเนินการจริงตามข้อสรุป`,
            approved: false,
          },
        });
      } catch {}
    }

    return NextResponse.json({ success: true, data: responses });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
