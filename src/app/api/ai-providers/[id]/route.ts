import { NextResponse } from 'next/server';
import { getProviderById, updateProvider, deleteProvider, maskProvider, maskBaseUrl } from '@/lib/ai-store';
import { validateProviderInput } from '@/lib/bot-input';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const provider = getProviderById(id);
    if (!provider) {
      return NextResponse.json({ success: false, error: 'ไม่พบ AI Provider' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: maskProvider(provider) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = getProviderById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'ไม่พบ AI Provider เพื่อแก้ไข' }, { status: 404 });
    }
    const body = await request.json().catch(() => null);
    const { data, error } = validateProviderInput(body, true);
    if (error || !data) {
      return NextResponse.json({ success: false, error }, { status: 400 });
    }
    // หน้าจอได้ baseUrl/apiKey แบบปิดบังไป ถ้าส่งกลับมาค่าเดิมแบบปิดบัง = ไม่ได้แก้ ห้ามบันทึกทับค่าจริง
    if (data.baseUrl === maskBaseUrl(existing.baseUrl)) delete data.baseUrl;
    if (!data.apiKey || /^•+$/.test(data.apiKey)) delete data.apiKey;

    const updated = updateProvider(id, data);
    return NextResponse.json({ success: true, data: updated && maskProvider(updated) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = deleteProvider(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'ไม่พบ AI Provider เพื่อลบ' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'ลบ AI Provider สำเร็จ' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
