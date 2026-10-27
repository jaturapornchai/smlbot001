import { NextResponse } from 'next/server';
import { getBotById } from '@/lib/bot-store';
import { callAIWithCascadeFallback } from '@/lib/ai-gateway';
import { withBotSlot } from '@/lib/vm-orchestrator';
import { validateChatInput } from '@/lib/bot-input';
import { BrokerNodeInfo, getRegisteredNodes, sendCrossProvinceMessage } from '@/lib/broker-hub';
import { BotMessage } from '@/types/bot';

// บอทสั่งงานข้ามจังหวัดด้วยการพิมพ์ directive นี้ในคำตอบ → console ส่งเข้า Kafka topic smlbot.tasks จริง
const DISPATCH_RE = /\[\[DISPATCH:([a-zA-Z0-9_.-]{1,120})\|([^\]]{1,500})\]\]/g;
const MAX_DISPATCH_PER_REPLY = 5;

// Redis หลุด: ioredis จะ retry ก่อน fail (~10 วิ) → ไม่ให้แชทรอนาน ตัดที่ 2 วิแล้วคุยต่อแบบไม่มีรายชื่อโหนด
async function loadRemoteNodes(selfId: string): Promise<BrokerNodeInfo[]> {
  const timeout = new Promise<BrokerNodeInfo[]>((resolve) => setTimeout(() => resolve([]), 2000));
  const nodes = await Promise.race([getRegisteredNodes(), timeout]);
  return nodes.filter((n) => n.botId !== selfId).slice(0, 30);
}

function dispatchGuide(nodes: BrokerNodeInfo[]): string {
  if (!nodes.length) return '';
  const list = nodes.map((n) => `- ${n.botId} | ${n.botName} | ${n.province || '-'} | ${n.status}`).join('\n');
  return `

[เครือข่ายบอทข้ามจังหวัด (Cloud Hub)]
ถ้าผู้ใช้สั่งให้ส่งงานไปให้บอทตัวอื่น ให้ใส่คำสั่งนี้ในคำตอบ 1 บรรทัดต่อ 1 งาน (ใช้ botId จากรายการเท่านั้น ห้ามแต่งขึ้นเอง):
[[DISPATCH:<botId>|<รายละเอียดภารกิจภาษาไทย>]]
รายชื่อบอทที่ออนไลน์ (botId | ชื่อ | จังหวัด | สถานะ):
${list}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const bot = getBotById(id);
    if (!bot) {
      return NextResponse.json({ success: false, error: 'ไม่พบ Bot' }, { status: 404 });
    }

    const { data: input, error: inputError } = validateChatInput(await request.json().catch(() => null));
    if (!input) {
      return NextResponse.json({ success: false, error: inputError }, { status: 400 });
    }
    const userMessage = input.message;

    const nodes = await loadRemoteNodes(bot.id);
    const aiMessages = [
      ...input.history.map((h) => ({
        role: h.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: h.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    let replyContent = '';
    let usedFallback = false;
    let usedModel = bot.modelName;
    let aiFailed = false;

    // บอทว่าง → ตั้ง busy แล้วคืนเสมอ; ไม่ว่าง + Auto-Clone → ยืม Clone แล้วคืนเมื่อจบ
    const { clone } = await withBotSlot(bot.id, userMessage, async () => {
      try {
        // Multi-Tier Cascade Failover (Primary -> Backup -> Auto-Discovery หาตัวที่ทำงานได้มาทำแทน)
        const aiResponse = await callAIWithCascadeFallback({
          botName: bot.name,
          primaryProviderId: bot.providerId,
          primaryModelName: bot.modelName,
          fallbackProviderId: bot.fallbackProviderId,
          fallbackModelName: bot.fallbackModelName,
          temperature: bot.temperature,
          maxTokens: bot.maxTokens,
          systemPrompt: bot.systemPrompt + dispatchGuide(nodes),
          messages: aiMessages,
        });
        replyContent = aiResponse.content;
        usedFallback = aiResponse.isFallback;
        usedModel = aiResponse.usedModel;
      } catch (err: any) {
        aiFailed = true;
        replyContent = `ขออภัยครับ ไม่พบ AI ตัวใดในระบบที่พร้อมทำงาน (${err.message})`;
      }
    });

    // ดึง directive ส่งงานข้ามจังหวัดออกจากคำตอบ (รับเฉพาะ botId ที่อยู่ใน registry จริง)
    const knownIds = new Set(nodes.map((n) => n.botId));
    const dispatches = aiFailed
      ? []
      : [...replyContent.matchAll(DISPATCH_RE)]
          .map((m) => ({ toBotId: m[1], task: m[2].trim() }))
          .filter((d) => knownIds.has(d.toBotId))
          .slice(0, MAX_DISPATCH_PER_REPLY);
    // คำตอบที่มีแต่ directive จะว่างหลังตัดออก → ใส่ข้อความแทน ไม่ให้เป็นฟองแชทเปล่า
    replyContent =
      replyContent.replace(DISPATCH_RE, '').trim() ||
      (dispatches.length ? `รับทราบครับ เตรียมส่งภารกิจข้ามจังหวัด ${dispatches.length} งาน` : '');

    let draftAction: BotMessage['draftAction'] = undefined;
    const dispatchResults: NonNullable<BotMessage['dispatchResults']> = [];
    const nodeName = (botId: string) => nodes.find((n) => n.botId === botId)?.botName || botId;

    if (dispatches.length && bot.requireApproval) {
      // Human-in-the-loop: ยังไม่ส่ง รอผู้ใช้กดอนุมัติ (ปุ่มอนุมัติจะส่งเข้า Kafka จริง)
      draftAction = {
        type: 'cross_province_dispatch',
        title: `อนุมัติส่งภารกิจข้ามจังหวัด ${dispatches.length} งาน`,
        details: dispatches.map((d) => `→ ${nodeName(d.toBotId)}: ${d.task}`).join('\n'),
        approved: false,
        dispatches,
      };
    } else {
      for (const d of dispatches) {
        const ok = await sendCrossProvinceMessage('smlbot.tasks', {
          fromBotId: bot.id,
          toBotId: d.toBotId,
          province: nodes.find((n) => n.botId === d.toBotId)?.province,
          action: 'task',
          payload: { task: d.task, requestedBy: 'user-chat' },
        });
        dispatchResults.push({ toBotId: d.toBotId, toBotName: nodeName(d.toBotId), task: d.task, ok });
      }
    }

    if (!draftAction && bot.requireApproval && /สั่ง|บันทึก|ลบ|รัน/.test(userMessage)) {
      draftAction = {
        type: 'confirm_execution',
        title: `อนุมัติคำสั่ง: ${userMessage.slice(0, 30)}`,
        details: `บอท ${bot.name} (${usedModel}) ขอการยืนยันก่อนดำเนินการบันทึก/ส่งผลลัพธ์`,
        approved: false,
      };
    }

    if (clone) {
      replyContent = `[👥 ${clone.name} รับงานแทน เพราะบอทตัวหลักกำลังติดภารกิจอื่น]\n\n${replyContent}`;
    }

    const replyMsg: BotMessage = {
      id: `bot-msg-${Date.now()}`,
      botId: bot.id,
      senderName: clone ? clone.name : bot.name,
      avatar: bot.avatar,
      sender: 'bot',
      content: replyContent,
      usedFallback,
      usedModel,
      cloneInfo: clone ? { isClone: true, cloneIndex: clone.cloneIndex, parentName: bot.name } : undefined,
      timestamp: new Date().toISOString(),
      draftAction,
      dispatchResults: dispatchResults.length ? dispatchResults : undefined,
    };

    return NextResponse.json({ success: true, data: replyMsg });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
