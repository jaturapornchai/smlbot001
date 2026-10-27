'use client';

import React, { useState, useEffect } from 'react';
import { AIProviderConfig } from '@/types/ai';
import {
  Cpu,
  Plus,
  CheckCircle,
  AlertCircle,
  Globe,
  Server,
  Trash2,
  Play,
  RotateCw,
  Key,
  Edit2,
  Zap,
} from 'lucide-react';

interface TestResult {
  status: 'idle' | 'testing' | 'success' | 'error';
  message?: string;
  latencyMs?: number;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testingAll, setTestingAll] = useState(false);

  // Add Provider Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [description, setDescription] = useState('');
  const [isLocal, setIsLocal] = useState(false);

  // Edit Provider Modal State
  const [editProvider, setEditProvider] = useState<AIProviderConfig | null>(null);
  const [editApiKey, setEditApiKey] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [editDefaultModel, setEditDefaultModel] = useState('');

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/ai-providers');
      const data = await res.json();
      if (data.success) {
        setProviders(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  // ทดสอบ Provider รายตัว
  const handleTestProvider = async (id: string) => {
    setTestResults((prev) => ({
      ...prev,
      [id]: { status: 'testing' },
    }));

    try {
      const res = await fetch(`/api/ai-providers/${id}/test`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        setTestResults((prev) => ({
          ...prev,
          [id]: {
            status: 'success',
            message: 'พร้อมใช้งาน',
            latencyMs: data.latencyMs,
          },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [id]: {
            status: 'error',
            message: data.error || 'เชื่อมต่อไม่สำเร็จ',
            latencyMs: data.latencyMs,
          },
        }));
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          status: 'error',
          message: err.message,
        },
      }));
    }
  };

  // ทดสอบทั้งหมดพร้อมกัน
  const handleTestAll = async () => {
    setTestingAll(true);
    await Promise.all(providers.map((p) => handleTestProvider(p.id)));
    setTestingAll(false);
  };

  // บันทึก Provider ใหม่
  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !baseUrl.trim()) return;

    try {
      const res = await fetch('/api/ai-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          baseUrl,
          apiKey,
          defaultModel: defaultModel || 'default-model',
          availableModels: [defaultModel || 'default-model'],
          description,
          isLocal,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setName('');
        setApiKey('');
        setDefaultModel('');
        setDescription('');
        await fetchProviders();
      } else {
        alert(`เพิ่ม AI Provider ไม่สำเร็จ: ${data.error || res.status}`);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // อัปเดต Provider / ใส่ API Key
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProvider) return;

    try {
      const updatePayload: any = {
        baseUrl: editBaseUrl,
        defaultModel: editDefaultModel,
      };
      if (editApiKey.trim()) {
        updatePayload.apiKey = editApiKey.trim();
      }

      const res = await fetch(`/api/ai-providers/${editProvider.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      const data = await res.json();
      if (data.success) {
        setEditProvider(null);
        await fetchProviders();
        // ทดสอบทันทีหลังใส่ Key
        handleTestProvider(editProvider.id);
      } else {
        alert(`บันทึก AI Provider ไม่สำเร็จ: ${data.error || res.status}`);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm('ยืนยันที่จะลบ AI Provider นี้หรือไม่?')) return;
    try {
      const res = await fetch(`/api/ai-providers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchProviders();
      } else {
        alert(`ลบ AI Provider ไม่สำเร็จ: ${data.error || res.status}`);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            จัดการสมองกล AI (AI Providers & API Gateway)
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            เชื่อมต่อและทดสอบความพร้อมของ API โมเดล AI ทั้ง Cloud API และ Private Local Network
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestAll}
            disabled={testingAll || loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 shadow-xs hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 transition-colors"
          >
            <Zap className={`h-4 w-4 text-amber-500 ${testingAll ? 'animate-bounce' : ''}`} />
            <span>{testingAll ? 'กำลังทดสอบทั้งหมด...' : 'ทดสอบความพร้อมทั้งหมด'}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>เพิ่ม AI Provider</span>
          </button>
        </div>
      </div>

      {/* Providers Grid */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-neutral-500">
          กำลังโหลดรายการ AI Providers...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {providers.map((p) => {
            const testResult = testResults[p.id];
            const isTesting = testResult?.status === 'testing';
            const isSuccess = testResult?.status === 'success';
            const isError = testResult?.status === 'error';

            return (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="space-y-3">
                  {/* Top Bar: Icon, Name, Type */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                        <Cpu className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 className="font-semibold text-neutral-900 dark:text-white">
                          {p.name}
                        </h2>
                        <span className="text-xs text-neutral-400 font-mono">
                          ID: {p.id}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        p.isLocal
                          ? 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-950/50 dark:text-purple-400'
                          : 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20 dark:bg-indigo-950/50 dark:text-indigo-400'
                      }`}
                    >
                      {p.isLocal ? <Server className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                      <span>{p.isLocal ? 'Private Local LAN' : 'Cloud API'}</span>
                    </span>
                  </div>

                  <p className="text-xs text-neutral-600 dark:text-neutral-300">
                    {p.description}
                  </p>

                  {/* Details Box */}
                  <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-950 space-y-1.5">
                    <div className="flex items-center justify-between text-neutral-500">
                      <span>Base URL:</span>
                      <span className="font-mono text-neutral-800 dark:text-neutral-200 truncate max-w-[220px]">
                        {p.baseUrl}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-neutral-500">
                      <span>โมเดลเริ่มต้น:</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                        {p.defaultModel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-neutral-500">
                      <span>API Key:</span>
                      <span className="font-mono text-neutral-600 dark:text-neutral-300">
                        {p.apiKey || (p as any).hasKey ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <span>••••••••••••••••</span>
                            <span className="text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded">ปลอดภัย</span>
                          </span>
                        ) : p.isLocal ? (
                          <span className="text-neutral-400">(Local Proxy ไม่ต้องใช้ Key)</span>
                        ) : (
                          <span className="text-red-500 font-semibold">ยังไม่ได้ระบุ Key</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Available Models */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {p.availableModels.map((m) => (
                      <span
                        key={m}
                        className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[11px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Bar: Live Test Status & Action Buttons */}
                <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  {/* Status Indicator */}
                  <div className="flex items-center gap-1.5 text-xs">
                    {isTesting ? (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                        <RotateCw className="h-3.5 w-3.5 animate-spin" />
                        <span>กำลังทดสอบ...</span>
                      </span>
                    ) : isSuccess ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>พร้อมใช้งาน ({testResult.latencyMs} ms)</span>
                      </span>
                    ) : isError ? (
                      <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium" title={testResult.message}>
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate max-w-[170px]">{testResult.message}</span>
                      </span>
                    ) : (
                      <span className="text-neutral-400 text-xs">
                        {p.apiKey || p.isLocal ? 'ยังไม่ได้ทดสอบ' : '⚠️ ต้องใส่ API Key'}
                      </span>
                    )}
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex items-center gap-1.5">
                    {/* ปุ่มแก้ไข / ใส่ API Key */}
                    <button
                      onClick={() => {
                        setEditProvider(p);
                        setEditBaseUrl(p.baseUrl);
                        setEditDefaultModel(p.defaultModel);
                        setEditApiKey('');
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                      title="ใส่ API Key หรือแก้ไขการเชื่อมต่อ"
                    >
                      <Key className="h-3.5 w-3.5 text-indigo-500" />
                      <span>ตั้งค่า Key</span>
                    </button>

                    {/* ปุ่มทดสอบการเชื่อมต่อ */}
                    <button
                      onClick={() => handleTestProvider(p.id)}
                      disabled={isTesting}
                      className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900 disabled:opacity-50"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>ทดสอบ</span>
                    </button>

                    {!['xai', 'deepseek', 'local-glm-88', 'local-kimi-88', 'openai'].includes(p.id) && (
                      <button
                        onClick={() => handleDeleteProvider(p.id)}
                        className="p-1 text-neutral-400 hover:text-red-600"
                        title="ลบ Provider"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Provider / Set API Key Modal */}
      {editProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Key className="h-4 w-4 text-indigo-600" />
                <span>ตั้งค่า {editProvider.name}</span>
              </h2>
              <span className="text-xs font-mono text-neutral-400">ID: {editProvider.id}</span>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300">
                  API Key
                </label>
                <input
                  type="password"
                  value={editApiKey}
                  onChange={(e) => setEditApiKey(e.target.value)}
                  placeholder={editProvider.apiKey ? 'เว้นว่างไว้เพื่อใช้ Key เดิม' : 'ใส่ API Key ที่นี่ (sk-...) '}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-800"
                />
                <span className="text-[11px] text-neutral-400 mt-1 block">
                  {editProvider.apiKey ? 'มี Key บันทึกอยู่แล้ว หากต้องการเปลี่ยนให้พิมพ์ Key ใหม่ทับ' : 'กรุณาใส่ API Key เพื่อเปิดใช้งาน'}
                </span>
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300">
                  Base URL
                </label>
                <input
                  type="text"
                  required
                  value={editBaseUrl}
                  onChange={(e) => setEditBaseUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300">
                  โมเดลเริ่มต้น
                </label>
                <input
                  type="text"
                  required
                  value={editDefaultModel}
                  onChange={(e) => setEditDefaultModel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditProvider(null)}
                  className="rounded-lg border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 transition-colors"
                >
                  บันทึก & ทดสอบทันที
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Provider Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">
              เพิ่ม AI Provider ใหม่ (OpenAI Compatible)
            </h2>

            <form onSubmit={handleCreateProvider} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300">
                  ชื่อผู้ให้บริการ *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น Groq API, Local Ollama, vLLM"
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300">
                  Base URL *
                </label>
                <input
                  type="text"
                  required
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="ใส่ API Key ของผู้ให้บริการ"
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300">
                  ชื่อโมเดลเริ่มต้น
                </label>
                <input
                  type="text"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  placeholder="เช่น deepseek-chat"
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isLocalCheck"
                  checked={isLocal}
                  onChange={(e) => setIsLocal(e.target.checked)}
                  className="h-4 w-4 rounded accent-indigo-600"
                />
                <label htmlFor="isLocalCheck" className="text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  เป็น Local Server ในวงแลน (Private Network)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 transition-colors"
                >
                  บันทึก Provider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
