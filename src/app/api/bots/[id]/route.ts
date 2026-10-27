import { NextResponse } from 'next/server';
import { getBotById, updateBot, deleteBot, getAllGroups, updateGroup } from '@/lib/bot-store';
import { removeVM } from '@/lib/vm-orchestrator';
import { validateBotInput } from '@/lib/bot-input';
import { unregisterBotNode } from '@/lib/broker-hub';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bot = getBotById(id);
    if (!bot) {
      return NextResponse.json({ success: false, error: 'ไม่พบ Bot ที่ระบุ' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: bot });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // whitelist ฟิลด์เท่านั้น: เดิมรับ body ทั้งก้อน → client ตั้ง vmConfig.containerName แล้วฉีดคำสั่ง shell ได้
    const { data: input, error } = validateBotInput(await request.json().catch(() => null), true);
    if (!input) {
      return NextResponse.json({ success: false, error }, { status: 400 });
    }
    const updated = updateBot(id, input);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'ไม่พบ Bot เพื่อแก้ไข' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bot = getBotById(id);
    if (!bot) {
      return NextResponse.json({ success: false, error: 'ไม่พบ Bot เพื่อลบ' }, { status: 404 });
    }

    // ลบคอนเทนเนอร์หลัก + Clone ทั้งหมด (โฟลเดอร์ข้อมูลบนโฮสต์เก็บไว้ กันลบงานของบอทถาวร)
    const containers = [bot.vmConfig?.containerName, ...(bot.clones || []).map((c) => c.containerName)].filter(
      (name): name is string => Boolean(name)
    );
    const results = await Promise.all(containers.map((name) => removeVM(name)));
    const leftovers = containers.filter((_, i) => !results[i]);

    // เอาบอทออกจากทุกกลุ่ม (เดิมค้าง id ไว้ ห้องทีมจะหาบอทไม่เจอ)
    for (const g of getAllGroups()) {
      if (g.memberBotIds.includes(id) || g.leaderBotId === id) {
        const rest = g.memberBotIds.filter((m) => m !== id);
        // หัวหน้าถูกลบ → ให้สมาชิกคนแรกที่เหลือเป็นหัวหน้าแทน
        updateGroup(g.id, { memberBotIds: rest, leaderBotId: g.leaderBotId === id ? rest[0] || '' : g.leaderBotId });
      }
    }

    deleteBot(id);
    void unregisterBotNode(id); // ไม่รอ: Redis ล่มก็ยังลบบอทได้ (TTL 90 วิเป็นตัวสำรอง)
    return NextResponse.json({
      success: true,
      message: leftovers.length
        ? `ลบ Bot แล้ว แต่ลบคอนเทนเนอร์ไม่สำเร็จ ${leftovers.length} ตัว (${leftovers.join(', ')}) กรุณาตรวจบนเซิร์ฟเวอร์หลัก`
        : 'ลบ Bot และ VM สำเร็จ',
      leftovers,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
