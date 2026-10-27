import { NextResponse } from 'next/server';
import {
  BROKER_TOPICS,
  BrokerTopic,
  getBrokerStatus,
  getRegisteredNodes,
  registerBotHeartbeat,
  sendCrossProvinceMessage,
} from '@/lib/broker-hub';
import { getAllBots } from '@/lib/bot-store';

const LOCAL_PROVINCE = 'นนทบุรี / กรุงเทพฯ (Local Core)';

export async function GET() {
  try {
    // ส่ง Heartbeat ของบอทในเครื่องก่อน แล้วค่อยอ่าน registry เพื่อให้เห็นตัวเองตั้งแต่ครั้งแรก
    await Promise.all(
      getAllBots().map((b) =>
        registerBotHeartbeat(b.id, {
          botName: b.name,
          province: LOCAL_PROVINCE,
          status: b.isBusy ? 'busy' : 'online',
          meta: {
            workMode: b.workMode,
            modelName: b.modelName,
            vmPort: b.vmConfig?.hostPort,
          },
        })
      )
    );

    const [status, nodes] = await Promise.all([getBrokerStatus(), getRegisteredNodes()]);

    // ไม่มีข้อมูลจำลอง: Redis หลุด = nodes ว่าง + broker.redis.error บอกสาเหตุจริง
    return NextResponse.json({ success: true, broker: status, nodes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }
    const { action, topic, botId, message } = body;

    if (action === 'heartbeat') {
      if (typeof botId !== 'string' || !botId.trim() || typeof body.botName !== 'string') {
        return NextResponse.json({ success: false, error: 'ต้องระบุ botId และ botName' }, { status: 400 });
      }
      const ok = await registerBotHeartbeat(botId, {
        botName: body.botName.slice(0, 120),
        province: typeof body.province === 'string' ? body.province.slice(0, 120) : undefined,
        status: ['online', 'busy', 'idle'].includes(body.status) ? body.status : 'online',
      });
      return NextResponse.json({ success: ok, error: ok ? undefined : 'เชื่อมต่อ Redis ไม่สำเร็จ' });
    }

    if (action === 'send') {
      const targetTopic: BrokerTopic = topic ?? 'smlbot.messages';
      if (!BROKER_TOPICS.includes(targetTopic)) {
        return NextResponse.json({ success: false, error: `ไม่รู้จัก topic: ${topic}` }, { status: 400 });
      }
      if (
        !message ||
        typeof message.fromBotId !== 'string' ||
        typeof message.action !== 'string' ||
        (message.toBotId !== undefined && typeof message.toBotId !== 'string')
      ) {
        return NextResponse.json({ success: false, error: 'ต้องระบุ message.fromBotId และ message.action' }, { status: 400 });
      }
      const ok = await sendCrossProvinceMessage(targetTopic, {
        fromBotId: message.fromBotId,
        toBotId: message.toBotId,
        province: message.province,
        action: message.action,
        payload: message.payload,
      });
      return NextResponse.json({ success: ok, error: ok ? undefined : 'ส่งเข้า Kafka ไม่สำเร็จ (Cloud Hub ไม่ตอบสนอง)' });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
