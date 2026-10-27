import { NextResponse } from 'next/server';
import { runGlobalAutonomousTick } from '@/lib/autonomous-engine';
import { getAllBots } from '@/lib/bot-store';
import { BotActivityLog } from '@/types/bot';

export async function GET() {
  try {
    const bots = getAllBots();
    // รวบรวม logs ทั้งหมดจากบอททุกตัว จัดเรียงตามเวลาล่าสุด
    const allLogs: BotActivityLog[] = [];
    bots.forEach((b) => {
      if (b.activityLogs && Array.isArray(b.activityLogs)) {
        allLogs.push(...b.activityLogs);
      }
    });

    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      success: true,
      data: {
        activeBotsCount: bots.filter((b) => b.status === 'active').length,
        autonomousEnabledCount: bots.filter((b) => b.autonomousEnabled).length,
        recentLogs: allLogs.slice(0, 30),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const forceAll = Boolean(body?.forceAll);
    const result = await runGlobalAutonomousTick(forceAll);
    if (!result) {
      return NextResponse.json({ success: false, error: 'รอบ Autonomous ก่อนหน้ายังทำงานไม่เสร็จ กรุณารอสักครู่' }, { status: 409 });
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
