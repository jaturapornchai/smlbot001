'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AIProviderConfig } from '@/types/ai';
import { Bot, ArrowLeft, Server, Cpu, ShieldCheck, Sparkles } from 'lucide-react';

export default function NewBotPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [deployVMImmediately, setDeployVMImmediately] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🤖');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'assistant' | 'analyst' | 'worker' | 'trading' | 'custom'>('assistant');
  const [workMode, setWorkMode] = useState<'solo' | 'team' | 'hybrid'>('hybrid');
  
  const [providerId, setProviderId] = useState('deepseek');
  const [modelName, setModelName] = useState('deepseek-chat');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [systemPrompt, setSystemPrompt] = useState('คุณคือบอทผู้ช่วยอัจฉริยะ ทำหน้าที่ตามบทบาทที่ได้รับมอบหมายอย่างแม่นยำ');
  const [requireApproval, setRequireApproval] = useState(true);

  useEffect(() => {
    fetch('/api/ai-providers')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.length > 0) {
          setProviders(data.data);
          const defaultProv = data.data[0];
          setProviderId(defaultProv.id);
          setModelName(defaultProv.defaultModel || defaultProv.availableModels[0] || 'default');
        }
      })
      .catch(console.error);
  }, []);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setProviderId(selectedId);
    const prov = providers.find((p) => p.id === selectedId);
    if (prov) {
      setModelName(prov.defaultModel || prov.availableModels[0] || 'default');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim()) {
      alert('กรุณากรอกชื่อและบทบาทของ Bot');
      return;
    }

    setLoading(true);
    try {
      // 1. สร้าง Bot ในระบบ
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          avatar,
          role,
          description,
          category,
          workMode,
          providerId,
          modelName,
          temperature: Number(temperature),
          maxTokens: Number(maxTokens),
          systemPrompt,
          requireApproval,
          deployVM: deployVMImmediately,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'สร้าง Bot ล้มเหลว');
      }

      if (data.vmError) {
        alert(`สร้าง Bot แล้ว แต่ Deploy VM ไม่สำเร็จ: ${data.vmError}\nกด Deploy ใหม่ได้จากหน้ารายการ Bot`);
      }

      router.push('/bots');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedProviderObj = providers.find((p) => p.id === providerId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3 border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <Link
          href="/bots"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
            สร้างและกำหนดคุณสมบัติ Bot ใหม่
          </h1>
          <p className="text-xs text-neutral-500">
            ระบบจะสร้าง Isolated Container Agent Zero บนเซิร์ฟเวอร์หลักให้อัตโนมัติ
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: ข้อมูลและตัวตน (Identity) */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Bot className="h-4 w-4 text-indigo-600" />
            <span>1. ข้อมูลพื้นฐาน & ตัวตน (Identity)</span>
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                ไอคอน / Avatar
              </label>
              <input
                type="text"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                maxLength={4}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-center text-lg dark:border-neutral-700 dark:bg-neutral-800"
                placeholder="🤖"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                ชื่อ Bot *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                placeholder="เช่น ผู้ช่วยฝ่ายจัดซื้อ, นักวิเคราะห์สต็อก"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                บทบาทหน้าที่ (Role) *
              </label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                placeholder="เช่น วิเคราะห์ยอดขายและสินค้าคงคลัง"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                รูปแบบการทำงาน (Work Mode)
              </label>
              <select
                value={workMode}
                onChange={(e) => setWorkMode(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              >
                <option value="hybrid">🔄 ทั้งเดี่ยวและทีม (Hybrid - ยืดหยุ่นสูงสุด)</option>
                <option value="solo">👤 ทำงานเดี่ยว (Solo - รันคนเดียวตามรอบเวลา)</option>
                <option value="team">👥 ทำงานเป็นทีม (Team Only - รอรับงานในกลุ่ม)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              คำอธิบายงานโดยละเอียด
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              placeholder="ระบุสิ่งที่บอทตัวนี้ต้องรับผิดชอบ เช่น ตรวจสอบยอดขายทุกสิ้นวัน และทำสรุปเข้าห้องกลุ่ม"
            />
          </div>
        </div>

        {/* Section 2: สมองกล AI & โมเดล */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Cpu className="h-4 w-4 text-emerald-600" />
            <span>2. กำหนดสมองกล AI (Model & API Gateway)</span>
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                ผู้ให้บริการ AI (AI Provider)
              </label>
              <select
                value={providerId}
                onChange={handleProviderChange}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isLocal ? '🔒 (Local LAN 88)' : '🌐 (Cloud)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                โมเดล (Model)
              </label>
              {selectedProviderObj?.availableModels && selectedProviderObj.availableModels.length > 0 ? (
                <select
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                >
                  {selectedProviderObj.availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                  placeholder="เช่น deepseek-chat"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Temperature (ความสร้างสรรค์: {temperature})
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="mt-2 w-full accent-indigo-600"
              />
              <span className="text-xs text-neutral-400">0.0 (แม่นยำตัวเลข) — 1.0 (สร้างสรรค์)</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Max Tokens
              </label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              System Prompt & กฎเหล็กประจำตัว Bot
            </label>
            <textarea
              rows={4}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono text-xs dark:border-neutral-700 dark:bg-neutral-800"
              placeholder="ระบุพฤติกรรม ข้อห้าม และแนวทางการคิด..."
            />
          </div>
        </div>

        {/* Section 3: สภาพแวดล้อม VM 24/7 (Agent Zero) */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Server className="h-4 w-4 text-purple-600" />
            <span>3. สภาพแวดล้อม VM 24/7 (Agent Zero บนเซิร์ฟเวอร์หลัก)</span>
          </h2>

          <div className="flex items-start gap-3 rounded-lg border border-purple-100 bg-purple-50/50 p-3.5 dark:border-purple-900/30 dark:bg-purple-950/20">
            <input
              type="checkbox"
              id="deployVM"
              checked={deployVMImmediately}
              onChange={(e) => setDeployVMImmediately(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-indigo-600"
            />
            <label htmlFor="deployVM" className="cursor-pointer text-xs text-neutral-700 dark:text-neutral-300">
              <span className="font-semibold text-purple-900 dark:text-purple-300 block">
                สร้างและสตาร์ท Container VM ทันที (Auto-provision 24/7)
              </span>
              ระบบจะจัดสรรพอร์ตว่างบนเซิร์ฟเวอร์หลัก (เช่น 50001, 50002...), เตรียมโฟลเดอร์ข้อมูลถาวร และสตาร์ทคอนเทนเนอร์ Agent Zero ให้อัตโนมัติ
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/bots"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            ยกเลิก
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            <span>{loading ? 'กำลังสร้างและรัน VM...' : 'บันทึกและสร้าง Bot'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
