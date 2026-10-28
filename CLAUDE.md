@~/.agents/AGENTS.md

# SML Bot — คำแนะนำและบริบทงานสำหรับ Claude Code (Hand-off Context)

> **ภารกิจ**: หา Bug ในระบบ, ยกระดับหน้าจอให้ดูพรีเมี่ยมด้วย Motion Graphic, และปรับปรุงระบบ Autonomous ให้เฉียบคมยิ่งขึ้น

---

## 🏗️ โครงสร้างสถาปัตยกรรมและ Infrastructure จริง (ห้าม Mock เด็ดขาด)
1. **SML Bot Console**:
   - Next.js 16.4.3 (App Router, Turbopack, Tailwind CSS v4)
   - รันใน Docker Container `smlbot-console` บน Ubuntu Server พอร์ต 3400
   - Volume: `/home/smlsoft/smlbot/data` (เก็บ `bots.json`, `groups.json`, `ai-providers.json`)
2. **24/7 Agent Zero VMs**:
   - รันบน Ubuntu Server พอร์ต 50001+ (เช่น `smlbot-bot-sml-commander` บนพอร์ต 50001)
   - Volume: `/home/smlsoft/smlbot/bots/<bot-id>/usr`
   - รองรับ CSRF Token และ Dynamic Allowed Origins เรียบร้อยแล้ว
3. **Cloud Broker Hub (โครงข่ายสื่อสารบอทข้ามจังหวัด)**:
   - Server คลาวด์กลาง (Redis 7 พอร์ต 6379, Apache Kafka KRaft พอร์ต 9092)
   - ใช้เชื่อมต่อบอทจากหลายสาขา/จังหวัดที่ไม่มี Fixed IP ให้คุยและส่งงานหากันได้
   - Topics: `smlbot.messages`, `smlbot.tasks`, `smlbot.events`
4. **สมองกล AI & Multi-Tier Cascade Failover**:
   - รองรับ DeepSeek API (`deepseek-chat`) เป็นสมองกลหลัก
   - **กฎเหล็ก**: *"ถ้า AI สำรองไม่ทำงาน ให้หาตัวที่ทำงานได้มาทำแทน"* 
   - จัดการผ่าน `callAIWithCascadeFallback` ใน `src/lib/ai-gateway.ts` (Tier 1 Primary -> Tier 2 Configured Backup -> Tier 3 Auto-Discovery หา Provider อื่นที่พร้อมในระบบ)

---

## 🔒 กฎเหล็กความปลอดภัย & UI มาตรฐาน (Security & UI Rules)
- **ห้ามแสดงความลับบนหน้าจอทั้งหมด**:
  - **API Key**: ห้ามแสดง Key จริงหรือสตริงรหัส ให้แสดงเป็น `•••••••••••••••• (ปลอดภัย)` เท่านั้น
  - **IP Address**: ห้ามแสดง IP จริงบนหน้าจอ ให้ใช้คำว่า *"เซิร์ฟเวอร์หลัก (Core Engine)"*, *"โครงข่ายคลาวด์กลาง (Cloud Hub)"*, หรือระบุเพียงเลขพอร์ต เช่น *"พอร์ต 50001"*
- **ห้ามมีคำว่า "Grok"**: บอทหลักชื่อ **"ผู้บัญชาการ SML (SML Commander)"** (`bot-sml-commander`)
- **Baseline เป็นหลัก (Baseline-First)**: ตัวหนังสือ ปุ่ม ช่องกรอก ไอคอน Badge ในแถวเดียวกันต้องอยู่ระนาบ Baseline และกึ่งกลางแนวนอนเดียวกันเป๊ะ (`items-center`)
- **Dark / Light Mode**: รองรับการสลับโหมดอย่างสมบูรณ์แบบ ดูสะอาดตาและพรีเมียม

## 📤 กฎก่อน Push GitHub (ลุงจืดตั้ง 2026-10-28)
- **ก่อน `git push` ทุกครั้ง ต้องอัปเดต `README.md` ให้ตรงกับโค้ดล่าสุดเสมอ**: ฟีเจอร์ / Config (env) / API / Limitation / ภาพประกอบ ที่เปลี่ยนในงานนั้น แล้ว commit README ไปพร้อมกัน
- ถ้าตรวจแล้ว README ไม่ต้องแก้ ให้แจ้งลุงจืดว่า "README ตรงกับโค้ดล่าสุดแล้ว" ก่อน push

---

## 🎯 สิ่งที่ Claude Code ต้องทำต่อ (Action Items)

### 1. ตรวจสอบและหา Bug ในระบบ (Bug Hunting & Edge Cases)
- ตรวจสอบ API Routes ทั้งหมดใน `src/app/api/` (Bots, Groups, AI Providers, Broker, Autonomous)
- ทดสอบ Edge Cases: กรณี AI Provider ล่มพร้อมกันหลายตัว, กรณี Kafka/Redis หลุดการเชื่อมต่อชั่วคราว
- ตรวจสอบระบบ Auto-Clone (`spawnBotCloneVM`): ให้แน่ใจว่าเมื่อ Clone ทำงานเสร็จ สถานะของบอทจะถูกคืนค่าอย่างถูกต้อง
- ตรวจสอบ Form Validation ในหน้าสร้างและแก้ไขบอท/Provider ไม่ให้เกิด Unhandled Exceptions

### 2. ปรับปรุงหน้าจอให้ดูพรีเมี่ยม มี Motion Graphic (Premium Motion UX)
- **Ambient Neon Glow & Glassmorphism**: เพิ่มลูกเล่นแสงเรืองรองนุ่มนวลบริเวณการ์ดสถานะและขอบ Pane
- **Motion Graphic Visualizations**:
  - Radar Scanner กราฟิกสแกนคลื่นเรดาร์สำหรับโหมด Monitor และโครงข่ายข้ามจังหวัด
  - Dynamic Pulse Wave แสดงสถานะเมื่อ AI กำลังคิดและประมวลผลคำตอบ
  - Live Data Stream Animation สำหรับ Activity Logs ฟีดสด
  - Smooth Accordion / Transition เวลาสลับโหมด Monitor / สั่งการ (Chat) / Live VM (Terminal)
- **Interactive Micro-Interactions**: Hover states, Ripple effects บนปุ่มกด และ Floating Tooltips

### 3. ปรับปรุงเรื่องอื่นๆ
- **Cross-Province Task Dispatch**: พัฒนาเครื่องมือให้บอทในแชทสามารถส่งภารกิจข้ามจังหวัดผ่าน Kafka Topic `smlbot.tasks` ได้จริง
- **Live Terminal Enhancement**: รองรับปุ่ม Fullscreen สำหรับหน้า Agent Zero VM และการรีเฟรชที่ลื่นไหล
- **Build & Deploy Script**: ทดสอบรัน `pnpm build` ให้ผ่านสะอาดตา และตรวจสอบผลหลัง deploy
