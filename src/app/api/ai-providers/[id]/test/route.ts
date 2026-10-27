import { NextResponse } from 'next/server';
import { getProviderById } from '@/lib/ai-store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const provider = getProviderById(id);

    if (!provider) {
      return NextResponse.json({ success: false, error: 'ไม่พบ AI Provider' }, { status: 404 });
    }

    // ตรวจสอบว่าต้องมี API Key หรือไม่
    if (!provider.isLocal && !provider.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'ยังไม่ได้ระบุ API Key (กรุณากดปุ่มแก้ไขเพื่อใส่ API Key)',
        isKeyMissing: true,
      });
    }

    const endpoint = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    const testPayload = {
      model: provider.defaultModel || (provider.availableModels && provider.availableModels[0]) || 'default',
      messages: [{ role: 'user', content: 'test ping' }],
      max_tokens: 2,
    };

    const startTime = Date.now();
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        let errMsg = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error?.message) {
            errMsg = parsed.error.message;
          }
        } catch {}

        return NextResponse.json({
          success: false,
          error: errMsg,
          status: res.status,
          latencyMs,
        });
      }

      return NextResponse.json({
        success: true,
        latencyMs,
        modelUsed: testPayload.model,
        message: 'เชื่อมต่อและตอบสนองสำเร็จ',
      });
    } catch (fetchErr: any) {
      const latencyMs = Date.now() - startTime;
      return NextResponse.json({
        success: false,
        error: fetchErr.name === 'TimeoutError' ? 'หมดเวลาเชื่อมต่อ (Timeout 10s)' : fetchErr.message,
        latencyMs,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
