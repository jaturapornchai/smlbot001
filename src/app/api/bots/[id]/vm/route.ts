import { NextResponse } from 'next/server';
import { getBotById, updateBot } from '@/lib/bot-store';
import { deployAgentZeroVM, startVM, stopVM, restartVM, getVMStatus, addClone, removeVM } from '@/lib/vm-orchestrator';

const ACTIONS = ['deploy', 'start', 'stop', 'restart', 'status', 'spawn_clone', 'remove_clone'] as const;
type VMAction = (typeof ACTIONS)[number];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bot = getBotById(id);
    if (!bot) {
      return NextResponse.json({ success: false, error: 'ไม่พบ Bot' }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const action = body?.action as VMAction;
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }

    if (action === 'spawn_clone') {
      const clone = await addClone(id);
      if (!clone) {
        return NextResponse.json(
          { success: false, error: `Clone ครบจำนวนสูงสุดแล้ว (${bot.maxClones ?? 0} ตัว) ปรับ "จำนวน Clone สูงสุด" ก่อน` },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, data: getBotById(id), message: `Clone #${clone.cloneIndex} สำเร็จ` });
    }

    if (action === 'remove_clone') {
      const clone = bot.clones?.find((c) => c.id === body?.cloneId);
      if (!clone) {
        return NextResponse.json({ success: false, error: 'ไม่พบ Clone ที่ระบุ' }, { status: 404 });
      }
      if (!(await removeVM(clone.containerName))) {
        return NextResponse.json({ success: false, error: 'ลบคอนเทนเนอร์ Clone ไม่สำเร็จ (เซิร์ฟเวอร์หลักไม่ตอบสนอง)' }, { status: 502 });
      }
      const latest = getBotById(id);
      const updated = updateBot(id, { clones: (latest?.clones || []).filter((c) => c.id !== clone.id) });
      return NextResponse.json({ success: true, data: updated, message: 'ลบ Clone สำเร็จ' });
    }

    if (action === 'deploy') {
      // ใช้พอร์ตเดิมถ้าเคย deploy แล้ว ลิงก์/บุ๊กมาร์กของผู้ใช้จะไม่เปลี่ยน
      const vmConfig = await deployAgentZeroVM(bot, bot.vmConfig?.hostPort);
      const updated = updateBot(id, { vmConfig, status: 'active' });
      return NextResponse.json({ success: true, data: updated });
    }

    if (!bot.vmConfig?.containerName) {
      return NextResponse.json({ success: false, error: 'Bot ตัวนี้ยังไม่ได้ Deploy บน VM Container' }, { status: 400 });
    }

    const containerName = bot.vmConfig.containerName;

    if (action === 'status') {
      const stat = await getVMStatus(containerName);
      return NextResponse.json({ success: true, data: stat });
    }

    // start/stop/restart: อัปเดตสถานะเฉพาะเมื่อ docker ทำสำเร็จจริง (เดิมตอบสำเร็จเสมอแม้คำสั่งล้มเหลว)
    const run = { start: startVM, stop: stopVM, restart: restartVM }[action];
    if (!(await run(containerName))) {
      return NextResponse.json(
        { success: false, error: `สั่ง ${action} VM ไม่สำเร็จ (คอนเทนเนอร์ไม่พบ หรือเซิร์ฟเวอร์หลักไม่ตอบสนอง)` },
        { status: 502 }
      );
    }
    const running = action !== 'stop';
    updateBot(id, {
      status: running ? 'active' : 'paused',
      vmConfig: { ...bot.vmConfig, status: running ? 'running' : 'stopped' },
    });
    const messages = {
      start: 'เริ่มการทำงานของ VM สำเร็จ (24/7)',
      stop: 'หยุดการทำงานของ VM สำเร็จ',
      restart: 'รีสตาร์ท VM สำเร็จ',
    };
    return NextResponse.json({ success: true, message: messages[action] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
