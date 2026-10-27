# Deploy SML Bot to Linux Server 192.168.2.88
$HOST_ADDR = "smlsoft@192.168.2.88"
$REMOTE_DIR = "/home/smlsoft/smlbot/console"
$BUNDLE_FILE = "smlbot-bundle.tar.gz"

Write-Host ">>> เริ่มแพ็คและส่งไฟล์ SML Bot ไปยัง $HOST_ADDR..." -ForegroundColor Cyan

# 1. สร้าง bundle archive
if (Test-Path $BUNDLE_FILE) { Remove-Item $BUNDLE_FILE -Force }
tar -czf $BUNDLE_FILE --exclude=node_modules --exclude=.next --exclude=.git --exclude=data .

# 2. ส่งไฟล์ผ่าน SCP
scp $BUNDLE_FILE "${HOST_ADDR}:/tmp/smlbot-bundle.tar.gz"
if (Test-Path $BUNDLE_FILE) { Remove-Item $BUNDLE_FILE -Force }

# 3. แตกไฟล์ และรัน docker compose บน Server
Write-Host ">>> กำลัง Build Docker Container และรันบน Server 192.168.2.88:3400..." -ForegroundColor Yellow
$remoteCmd = 'mkdir -p /home/smlsoft/smlbot/console && tar -xzf /tmp/smlbot-bundle.tar.gz -C /home/smlsoft/smlbot/console && rm -f /tmp/smlbot-bundle.tar.gz && cd /home/smlsoft/smlbot/console && docker compose up -d --build && docker compose ps'
ssh -o BatchMode=yes $HOST_ADDR $remoteCmd

Write-Host "`n>>> [สำเร็จ] SML Bot พร้อมใช้งานที่: http://192.168.2.88:3400" -ForegroundColor Green
