import fs from 'fs';

// เขียนไฟล์ชั่วคราวแล้ว rename ทับ (atomic บน filesystem เดียวกัน) กันไฟล์ขาดครึ่งเมื่อ process ตาย/เขียนซ้อน
// ponytail: ไม่มี lock ข้าม process — มีคอนเทนเนอร์ console ตัวเดียว ถ้าจะ scale หลายตัวต้องย้ายไป DB
export function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

// อ่านไม่ออก = โยน error ให้เห็น ห้ามคืนค่าเริ่มต้น เพราะการเขียนครั้งถัดไปจะทับข้อมูลจริงของลุงจืดทิ้ง
export function readJsonArray<T>(file: string, label: string): T[] {
  const raw = fs.readFileSync(file, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('ไม่ใช่ array');
    return parsed as T[];
  } catch (error: any) {
    throw new Error(`ไฟล์ข้อมูล ${label} เสียหาย (${error.message}) — ตรวจไฟล์ ${file} ก่อนใช้งานต่อ`);
  }
}
