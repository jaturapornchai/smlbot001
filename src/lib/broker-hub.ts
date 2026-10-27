import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';

export interface BrokerNodeInfo {
  botId: string;
  botName: string;
  province?: string;
  status: 'online' | 'busy' | 'idle';
  lastSeen: string;
  meta?: Record<string, any>;
}

export interface BrokerStatus {
  redis: {
    connected: boolean;
    latencyMs: number;
    registeredNodesCount: number;
    error?: string;
  };
  kafka: {
    connected: boolean;
    topics: string[];
    latencyMs: number;
    error?: string;
  };
}

// ค่าเชื่อมต่อมาจาก env เท่านั้น (.env บนเซิร์ฟเวอร์) — ห้าม hardcode host/password ในโค้ด
const REDIS_HOST = process.env.BROKER_REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.BROKER_REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.BROKER_REDIS_PASSWORD || undefined;

const KAFKA_BROKER = process.env.BROKER_KAFKA_HOST || '127.0.0.1:9092';

export const BROKER_TOPICS = ['smlbot.messages', 'smlbot.tasks', 'smlbot.events'] as const;
export type BrokerTopic = (typeof BROKER_TOPICS)[number];

let redisClient: Redis | null = null;
let kafkaInstance: Kafka | null = null;
let kafkaProducerPromise: Promise<Producer> | null = null;

// ============================================================================
// Redis Connection Management
// ============================================================================
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      connectTimeout: 5000,
      maxRetriesPerRequest: 2,
      // ห้ามคืน null: ioredis จะเลิกต่อใหม่ถาวร แล้ว client ที่ cache ไว้จะใช้ไม่ได้จนกว่าจะรีสตาร์ท
      // คำสั่งระหว่างหลุดจะ fail เร็วตาม maxRetriesPerRequest แล้วกลับมาเองเมื่อ Cloud Hub กลับมา
      retryStrategy(times) {
        return Math.min(times * 1000, 10000);
      },
    });

    redisClient.on('error', (err) => {
      console.warn('[BrokerHub Redis] Connection warning:', err.message);
    });
  }
  return redisClient;
}

// ============================================================================
// Kafka Connection Management
// ============================================================================
export function getKafka(): Kafka {
  if (!kafkaInstance) {
    kafkaInstance = new Kafka({
      clientId: 'smlbot-cloud-hub',
      brokers: [KAFKA_BROKER],
      connectionTimeout: 5000,
      requestTimeout: 10000,
    });
  }
  return kafkaInstance;
}

// cache เป็น Promise กันการ connect ซ้อน และล้างทิ้งเมื่อ connect พลาด/หลุด เพื่อให้ครั้งถัดไปต่อใหม่ได้
export function getKafkaProducer(): Promise<Producer> {
  if (!kafkaProducerPromise) {
    const producer = getKafka().producer();
    producer.on(producer.events.DISCONNECT, () => {
      kafkaProducerPromise = null;
    });
    kafkaProducerPromise = producer
      .connect()
      .then(() => producer)
      .catch((err) => {
        kafkaProducerPromise = null;
        throw err;
      });
  }
  return kafkaProducerPromise;
}

// ============================================================================
// Cross-Province Bot Registry & Heartbeat (ผ่าน Redis)
// ============================================================================
const REGISTRY_PREFIX = 'smlbot:registry:';
const HEARTBEAT_TTL_SEC = 90; // บอทที่ไม่ส่ง Heartbeat ใน 90 วินาที จะถือว่าหลุด

export async function registerBotHeartbeat(
  botId: string,
  info: {
    botName: string;
    province?: string;
    status?: 'online' | 'busy' | 'idle';
    meta?: Record<string, any>;
  }
): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const key = `${REGISTRY_PREFIX}${botId}`;
    const payload: BrokerNodeInfo = {
      botId,
      botName: info.botName,
      province: info.province || 'กรุงเทพมหานคร (ศูนย์บัญชาการ)',
      status: info.status || 'online',
      lastSeen: new Date().toISOString(),
      meta: info.meta || {},
    };

    await redis.set(key, JSON.stringify(payload), 'EX', HEARTBEAT_TTL_SEC);
    return true;
  } catch (error: any) {
    console.error('[BrokerHub] Heartbeat failed:', error.message);
    return false;
  }
}

// ลบบอทแล้วต้องถอนออกจาก registry ทันที ไม่งั้นบอทจังหวัดอื่นยังเห็นเป็น online และส่งงานมาหาได้อีก ~90 วิ (TTL)
export async function unregisterBotNode(botId: string): Promise<void> {
  try {
    await getRedisClient().del(`${REGISTRY_PREFIX}${botId}`);
  } catch (error: any) {
    console.warn('[BrokerHub] Unregister failed:', error.message);
  }
}

export async function getRegisteredNodes(): Promise<BrokerNodeInfo[]> {
  try {
    const redis = getRedisClient();
    const keys = await redis.keys(`${REGISTRY_PREFIX}*`);
    if (keys.length === 0) return [];

    const nodes: BrokerNodeInfo[] = [];
    const values = await redis.mget(...keys);
    for (const val of values) {
      if (val) {
        try {
          nodes.push(JSON.parse(val));
        } catch {}
      }
    }
    return nodes;
  } catch (error: any) {
    console.warn('[BrokerHub] Failed to fetch registered nodes:', error.message);
    return [];
  }
}

// ============================================================================
// Cross-Province Messaging (ผ่าน Kafka)
// ============================================================================
export async function sendCrossProvinceMessage(topic: BrokerTopic, message: {
  fromBotId: string;
  toBotId?: string;
  province?: string;
  action: string;
  payload: any;
}): Promise<boolean> {
  try {
    const producer = await getKafkaProducer();
    await producer.send({
      topic,
      messages: [
        {
          key: message.toBotId || message.fromBotId,
          value: JSON.stringify({
            ...message,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });
    return true;
  } catch (error: any) {
    console.error(`[BrokerHub Kafka] Failed to send message to topic ${topic}:`, error.message);
    return false;
  }
}

// ============================================================================
// Overall Broker Health Check
// ============================================================================
export async function getBrokerStatus(): Promise<BrokerStatus> {
  const result: BrokerStatus = {
    redis: {
      connected: false,
      latencyMs: 0,
      registeredNodesCount: 0,
    },
    kafka: {
      connected: false,
      topics: [],
      latencyMs: 0,
    },
  };

  // 1. Check Redis
  try {
    const redis = getRedisClient();
    const t0 = Date.now();
    const pong = await redis.ping();
    const t1 = Date.now();

    if (pong === 'PONG') {
      result.redis.connected = true;
      result.redis.latencyMs = t1 - t0;
      const keys = await redis.keys(`${REGISTRY_PREFIX}*`);
      result.redis.registeredNodesCount = keys.length;
    }
  } catch (error: any) {
    result.redis.error = error.message;
  }

  // 2. Check Kafka
  const admin = getKafka().admin();
  try {
    const t0 = Date.now();
    await admin.connect();
    const topics = await admin.listTopics();
    result.kafka.latencyMs = Date.now() - t0;
    result.kafka.connected = true;
    result.kafka.topics = topics.filter((t) => !t.startsWith('__'));
  } catch (error: any) {
    result.kafka.error = error.message;
  } finally {
    await admin.disconnect().catch(() => {});
  }

  return result;
}
