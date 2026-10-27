'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BotProperty } from '@/types/bot';
import { 
  Bot, 
  Play, 
  Square, 
  RotateCw, 
  ExternalLink, 
  Trash2, 
  Plus, 
  Server, 
  Shield, 
  Cpu, 
  AlertCircle 
} from 'lucide-react';

export default function BotsPage() {
  const [bots, setBots] = useState<BotProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBots = async () => {
    try {
      const res = await fetch('/api/bots');
      const data = await res.json();
      if (data.success) {
        setBots(data.data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBots();
  }, []);

  const handleVMAction = async (botId: string, action: 'deploy' | 'start' | 'stop' | 'restart') => {
    setActionLoading(`${botId}-${action}`);
    setMsg(null);
    try {
      const res = await fetch(`/api/bots/${botId}/vm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: `สั่งการ ${action} สำเร็จแล้ว` });
        await fetchBots();
      } else {
        setMsg({ type: 'error', text: data.error || 'เกิดข้อผิดพลาด' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteBot = async (botId: string) => {
    if (!confirm('ยืนยันที่จะลบ Bot ตัวนี้หรือไม่?')) return;
    try {
      const res = await fetch(`/api/bots/${botId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      setMsg({ type: data?.success && !data.leftovers?.length ? 'success' : 'error', text: data?.message || data?.error || 'ลบ Bot ไม่สำเร็จ' });
      if (data?.success) fetchBots();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            จัดการ Bot (24/7 Agent Zero VMs)
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            ควบคุมสถานะ คอนเทนเนอร์ และพอร์ตการทำงานของบอทแต่ละตัวบนเซิร์ฟเวอร์หลัก
          </p>
        </div>
        <Link
          href="/bots/new"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>เพิ่ม Bot ตัวใหม่</span>
        </Link>
      </div>

      {/* Alert Message */}
      {msg && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/50 dark:text-red-300'
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          <span>{msg.text}</span>
        </div>
      )}

      {/* Bots Grid */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-neutral-500">
          กำลังโหลดข้อมูลบอท...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {bots.map((bot) => {
            const hasVM = Boolean(bot.vmConfig?.containerName);
            const isVMRunning = bot.vmConfig?.status === 'running';

            return (
              <div
                key={bot.id}
                className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="space-y-4">
                  {/* Top Row: Avatar, Name, Status */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-2xl dark:bg-neutral-800">
                        {bot.avatar}
                      </span>
                      <div>
                        <h2 className="font-semibold text-neutral-900 dark:text-white">
                          {bot.name}
                        </h2>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {bot.role}
                        </p>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isVMRunning
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-400'
                          : hasVM
                          ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-400'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isVMRunning
                            ? 'bg-emerald-500 animate-pulse'
                            : hasVM
                            ? 'bg-amber-500'
                            : 'bg-neutral-400'
                        }`}
                      />
                      {isVMRunning ? 'VM รัน 24/7' : hasVM ? 'VM หยุดอยู่' : 'ยังไม่ Deploy VM'}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    {bot.description}
                  </p>

                  {/* VM Details Box */}
                  <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-950 space-y-1.5">
                    <div className="flex items-center justify-between text-neutral-500">
                      <span>เครื่องโฮสต์:</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        เซิร์ฟเวอร์หลัก (Docker Engine)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-neutral-500">
                      <span>สมองกล AI:</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {bot.modelName} ({bot.providerId})
                      </span>
                    </div>
                    {bot.vmConfig?.hostPort && (
                      <div className="flex items-center justify-between text-neutral-500">
                        <span>พอร์ต Web UI:</span>
                        <span className="font-mono font-bold text-neutral-900 dark:text-white">
                          พอร์ต {bot.vmConfig.hostPort}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-neutral-500">
                      <span>โหมดการทำงาน:</span>
                      <span>
                        {bot.workMode === 'solo'
                          ? '👤 ทำงานเดี่ยว'
                          : bot.workMode === 'team'
                          ? '👥 ทำงานเป็นทีม'
                          : '🔄 ทั้งเดี่ยวและทีม'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions Bar */}
                <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  {/* Left Controls: Start/Stop/Restart or Deploy */}
                  <div className="flex items-center gap-1.5">
                    {!hasVM ? (
                      <button
                        onClick={() => handleVMAction(bot.id, 'deploy')}
                        disabled={actionLoading === `${bot.id}-deploy`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                      >
                        <Server className="h-3.5 w-3.5" />
                        <span>
                          {actionLoading === `${bot.id}-deploy` ? 'กำลังสร้าง VM...' : 'Deploy VM (24/7)'}
                        </span>
                      </button>
                    ) : (
                      <>
                        {isVMRunning ? (
                          <button
                            onClick={() => handleVMAction(bot.id, 'stop')}
                            disabled={actionLoading === `${bot.id}-stop`}
                            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-amber-400"
                            title="หยุดทำงานชั่วคราว"
                          >
                            <Square className="h-3 w-3 fill-current" />
                            <span>หยุด</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleVMAction(bot.id, 'start')}
                            disabled={actionLoading === `${bot.id}-start`}
                            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-emerald-400"
                            title="เริ่มทำงาน 24/7"
                          >
                            <Play className="h-3 w-3 fill-current" />
                            <span>เริ่ม</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleVMAction(bot.id, 'restart')}
                          disabled={actionLoading === `${bot.id}-restart`}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                          title="รีสตาร์ท VM"
                        >
                          <RotateCw className="h-3 w-3" />
                          <span>รีสตาร์ท</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Right Controls: Open WebUI / Delete */}
                  <div className="flex items-center gap-2">
                    {!!bot.vmConfig?.hostPort && (
                      <a
                        href={`http://${window.location.hostname}:${bot.vmConfig.hostPort}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-400"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>เปิด Agent Zero</span>
                      </a>
                    )}

                    <button
                      onClick={() => handleDeleteBot(bot.id)}
                      className="inline-flex items-center justify-center rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                      title="ลบ Bot"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
