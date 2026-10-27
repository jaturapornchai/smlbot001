import { NextResponse } from 'next/server';
import { getAllGroups, createGroup } from '@/lib/bot-store';
import { validateGroupInput } from '@/lib/bot-input';

export async function GET() {
  try {
    const groups = getAllGroups();
    return NextResponse.json({ success: true, data: groups });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { data: input, error } = validateGroupInput(await request.json().catch(() => null));
    if (!input) {
      return NextResponse.json({ success: false, error }, { status: 400 });
    }
    const newGroup = createGroup(input);

    return NextResponse.json({ success: true, data: newGroup }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
