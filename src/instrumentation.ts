// เรียกครั้งเดียวตอน server เริ่ม: ล้างสถานะ busy ที่ค้างจากรอบก่อน + ตั้งตัวจับเวลา Autonomous 24/7
// (เดิมไม่มีอะไรเรียก tick อัตโนมัติ บอททำงานเฉพาะตอนกดปุ่มในหน้าเว็บ)
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.NODE_ENV !== 'production') return; // dev: กดปุ่มเองจากหน้าเว็บ ไม่ยิง AI เบื้องหลัง

  const { resetStaleBusyState } = await import('./lib/vm-orchestrator');
  resetStaleBusyState();

  // โหนด Cloud Hub (heartbeat + รับภารกิจข้ามจังหวัด) — ทดสอบในเครื่องให้ตั้ง BROKER_NODE=off กันปน registry/งานจริง
  if (process.env.BROKER_NODE !== 'off') {
    const { startHubNode } = await import('./lib/hub-node');
    startHubNode();
  }

  if (process.env.AUTONOMOUS_SCHEDULER === 'off') return;
  const { runGlobalAutonomousTick } = await import('./lib/autonomous-engine');
  // ทุก 60 วิ: เช็กว่าบอทตัวไหนถึงรอบ (autonomousIntervalMinutes) แล้วค่อยเรียก AI — tick ซ้อนถูกกันใน engine
  setInterval(() => {
    runGlobalAutonomousTick(false).catch((e) => console.error('[Autonomous Scheduler]', e.message));
  }, 60_000);
}
