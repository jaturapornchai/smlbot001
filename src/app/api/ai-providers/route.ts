import { NextResponse } from 'next/server';
import { getAllProviders, createProvider, maskProvider } from '@/lib/ai-store';
import { validateProviderInput } from '@/lib/bot-input';

export async function GET() {
  try {
    return NextResponse.json({ success: true, data: getAllProviders().map(maskProvider) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const { data, error } = validateProviderInput(body, false);
    if (error || !data) {
      return NextResponse.json({ success: false, error }, { status: 400 });
    }

    const defaultModel = data.defaultModel || 'default-model';
    const newProvider = createProvider({
      name: data.name!,
      providerType: data.providerType || 'custom_openai',
      baseUrl: data.baseUrl!,
      apiKey: data.apiKey || '',
      availableModels: data.availableModels?.length ? data.availableModels : [defaultModel],
      defaultModel,
      isLocal: Boolean(data.isLocal),
      isActive: data.isActive ?? true,
      description: data.description || '',
    });

    return NextResponse.json({ success: true, data: maskProvider(newProvider) }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
