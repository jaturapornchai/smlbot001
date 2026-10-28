<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SML Bot — กฎเหล็กโปรเจกต์ (Project Rules)

> **ใช้จริง ทดสอบจริง ไม่ต้อง Mock (Zero-Mocking & Real Infrastructure Policy)**

## 1. 🔒 กฎเหล็ก: ใช้จริง ทดสอบจริง ไม่ต้อง Mock (Strict No-Mocking)
- **ห้าม Mock ทุกกรณี**: ห้ามจำลองข้อมูลหลอก ห้ามใช้ Dummy Response ห้าม Hardcode ข้อความตอบกลับของบอท ทุกการสนทนาและการสั่งงานต้องส่ง Payload ไปยัง API ของโมเดลจริง (xAI, DeepSeek, Local GLM-5.2 Think, Local Kimi K3, OpenAI)
- **Honest Uncertainty**: หาก API ใดไม่สามารถเชื่อมต่อได้ ขาด API Key หรือ Endpoint ล่ม ให้รายงานข้อผิดพลาดจริง (`HTTP Error`, `Timeout`, `Missing Key`) ห้ามสร้างข้อมูลสมมุติมาแกล้งว่าสำเร็จ
- **ทดสอบจริงด้วยเครื่องมือจริง**: หน้าจอมีปุ่ม "ทดสอบ" (Test) สำหรับ AI Provider ทุกตัว ซึ่งต้องส่ง Ping Request ไปยัง Provider Base URL จริง และจับเวลา Latency จริงเป็นมิลลิวินาที

## 2. ⚡ ระบบ 24/7 Agent Zero VMs บน Server 192.168.2.88
- **Isolated VM จริง 100%**: บอททุกตัวในระบบคือคอนเทนเนอร์ Agent Zero (`agent0ai/agent-zero:latest`) รันบน Ubuntu Server `192.168.2.88` โดยมีพอร์ตโฮสต์เฉพาะตัว (เริ่มที่ `50001+`)
- **Auto-Deploy ทันทีเมื่อสร้าง Bot**: เมื่อสร้างบอทใหม่ ระบบต้องสั่ง Provision ไดเรกทอรี `/home/smlsoft/smlbot/bots/<bot-id>/usr`, สร้าง `secrets.env` และสั่ง `docker run -d --restart unless-stopped` ขึ้นมารัน 24/7 ทันที ไม่ต้องรอกดปุ่มแยก
- **Dynamic Auto-Clone เมื่อบอทไม่ว่าง**: เมื่อบอทกำลังติดภารกิจประมวลผลอยู่ (`isBusy: true`) และมีคำขอใหม่เข้ามา ระบบต้อง Clone ตัวเองโดยการสั่ง Docker Run Replica VM แยกพอร์ตและสภาพแวดล้อมจริงบนเซิร์ฟเวอร์ `192.168.2.88` เพื่อทำงานขนานได้ทันที ไม่เกิดคอขวด

## 3. 🛡️ สมองกลคู่ (Primary & Backup AI Failover)
- บอทแต่ละตัวสามารถระบุ **สมองกลหลัก (Primary AI)** และ **สมองกลสำรอง (Backup AI)**
- เมื่อเรียกใช้สมองกลหลักแล้วเกิดข้อผิดพลาด (เช่น Quota หมด หรือ API ล่ม) ระบบต้องสลับไปเรียกสมองกลสำรองจริงโดยอัตโนมัติ พร้อมแสดง Badge ระบุอย่างโปร่งใส

## 4. 👥 การทำงานร่วมกันเป็นทีม (Multi-Bot Collaboration)
- ในโหมดกลุ่ม (Group / Team) บอทแต่ละตัวต้องถูกเรียกด้วยโมเดลและ System Prompt ของตนเองจริง หัวหน้าทีมวิเคราะห์โจทย์จริง และส่งต่อให้ผู้เชี่ยวชาญตอบจริงตามบริบท ไม่ใช้ข้อความหลอก

## 5. 🎨 มาตรฐาน UI (Baseline-First & Premium Thai UX)
- **Baseline เป็นหลัก**: ข้อความ ปุ่ม ช่องกรอก ไอคอน Badge ในแถวเดียวกันต้องอยู่ระนาบ Baseline และกึ่งกลางแนวนอนเดียวกันเป๊ะ (`items-center`) ห้ามเหลื่อมสูง-ต่ำ
- **Dark/Light Mode**: รองรับสลับโหมดมืดและสว่าง พร้อมเอฟเฟกต์ Motion Graphic Ambient Glow และ Glassmorphism ที่สะอาดตา ดูพรีเมียม
- **ภาษาไทยที่เข้าใจง่าย**: ทุกข้อความ เมนู และคำสั่งเป็นภาษาไทย เพื่อประสบการณ์ผู้ใช้ที่ดีที่สุดสำหรับคนไทย
- **เรียก "ลุงจืด" เสมอ**: การสื่อสารทุกอย่างให้เรียกคุณจาตุรนต์ว่า "ลุงจืด" และตอบสั้น ตรงประเด็น

## 6. 🤖 ปรัชญาการออกแบบ: ระบบ Auto ทุกอย่าง คนแค่มาดู และกำหนดค่า ปรับปรุงคำสั่ง (Autonomous Architecture)
- **Auto ทุกอย่าง (Zero-Touch Autonomous Operations)**:
  - **Auto Run 24/7**: บอทมีรอบการทำงานอัตโนมัติต่อเนื่องตามเป้าหมาย (Autonomous Goal) โดยไม่ต้องรอให้คนมาคอยสั่ง
  - **Auto Deploy**: สร้างบอทปุ๊บ ระบบสั่งสตาร์ท VM Agent Zero 24/7 บน Server 192.168.2.88 ทันที
  - **Auto-Clone**: งานซ้อน/บอทติดงาน ระบบสั่งแตก Clone VM ทำงานขนานอัตโนมัติ
  - **Auto-Failover**: โมเดลหลักขัดข้อง ระบบสลับไปใช้โมเดลสำรองให้อัตโนมัติ
  - **Auto Self-Healing**: ตรวจสอบ VM ทุกตัว หากพบว่าหยุดทำงาน ระบบสั่งสตาร์ทกู้คืน 24/7 ให้ทันที
- **บทบาทของมนุษย์ (Human Oversight Role)**:
  - **คนแค่มาดู (Monitor & Audit)**: มอนิเตอร์ดูเรดาห์งานสด (Live Activity Log Feed) รายงานผลการทำงาน และสถานะของระบบ
  - **กำหนดค่า (Configure Parameters)**: กำหนดรอบความถี่ (นาที), สมองกลหลัก/สำรอง, และจำนวน Clone สูงสุด
  - **ปรับปรุงคำสั่ง (Refine Prompts & Directives)**: ขัดเกลา System Prompt และเป้าหมายภารกิจ (Goal) ให้บอททำงานเฉียบคมขึ้นอย่างต่อเนื่อง

## 7. 📤 กฎก่อน Push GitHub (ลุงจืดตั้ง 2026-10-28)
- **ก่อน `git push` ทุกครั้ง ต้องอัปเดต `README.md` ให้ตรงกับโค้ดล่าสุดเสมอ**: ฟีเจอร์ / Config (env) / API / Limitation / ภาพประกอบ ที่เปลี่ยนในงานนั้น แล้ว commit README ไปพร้อมกัน
- ถ้าตรวจแล้ว README ไม่ต้องแก้ ให้แจ้งลุงจืดว่า "README ตรงกับโค้ดล่าสุดแล้ว" ก่อน push
