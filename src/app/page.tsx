'use client';

import React, { useState, useEffect, useRef } from 'react';
import { BotProperty, BotGroup, BotMessage } from '@/types/bot';
import { AIProviderConfig } from '@/types/ai';
import {
  Bot,
  Users,
  Cpu,
  Play,
  Square,
  RotateCw,
  Send,
  Plus,
  Server,
  Settings,
  ShieldCheck,
  CheckCircle,
  Sparkles,
  Terminal,
  MessageSquare,
  Sliders,
  Power,
  RefreshCw,
  Activity,
  Zap,
  Copy,
  Trash2,
  ExternalLink,
  Radio,
  Network,
  MapPin,
  Layers,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export default function UnifiedControlCenter() {
  const [bots, setBots] = useState<BotProperty[]>([]);
  const [groups, setGroups] = useState<BotGroup[]>([]);
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Broker Hub & Cross-Province Mesh State
  const [brokerData, setBrokerData] = useState<any>(null);
  const [showBrokerModal, setShowBrokerModal] = useState(false);

  // Selected Target: either a Bot or a Group
  const [selectedType, setSelectedType] = useState<'bot' | 'group'>('bot');
  const [selectedId, setSelectedId] = useState<string>('');

  // Center View Mode: Monitor (มาดู) vs Chat (สั่งการ) vs Terminal (Agent Zero VM)
  const [viewMode, setViewMode] = useState<'monitor' | 'chat' | 'terminal'>('monitor');

  // Chat State
  const [chatMessages, setChatMessages] = useState<Record<string, BotMessage[]>>({});
  const [inputPrompt, setInputPrompt] = useState('');
  const [sending, setSending] = useState(false);

  // Action Loading
  const [actionLoading, setActionLoading] = useState(false);
  const [autonomousRunning, setAutonomousRunning] = useState(false);
  const [globalLogs, setGlobalLogs] = useState<any[]>([]);

  // Inspector Edit State
  const [inspectorPrompt, setInspectorPrompt] = useState('');
  const [inspectorTemp, setInspectorTemp] = useState(0.7);
  const [inspectorModel, setInspectorModel] = useState('');
  const [inspectorProviderId, setInspectorProviderId] = useState('deepseek');
  const [inspectorFallbackModel, setInspectorFallbackModel] = useState('');
  const [inspectorFallbackProviderId, setInspectorFallbackProviderId] = useState('');
  const [inspectorAutoClone, setInspectorAutoClone] = useState(true);
  const [inspectorMaxClones, setInspectorMaxClones] = useState(3);
  const [inspectorAutonomousEnabled, setInspectorAutonomousEnabled] = useState(true);
  const [inspectorAutonomousInterval, setInspectorAutonomousInterval] = useState(15);
  const [inspectorAutonomousGoal, setInspectorAutonomousGoal] = useState('');
  const [inspectorSaving, setInspectorSaving] = useState(false);

  // New Bot Modal
  const [showAddBotModal, setShowAddBotModal] = useState(false);
  const [creatingBot, setCreatingBot] = useState(false);

  // Live VM (Agent Zero iframe): รีเฟรชด้วยการ remount + overlay โหลด, Fullscreen API
  const terminalRef = useRef<HTMLDivElement>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [frameLoading, setFrameLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [newBotRole, setNewBotRole] = useState('');
  const [newBotAvatar, setNewBotAvatar] = useState('🤖');
  const [newBotWorkMode, setNewBotWorkMode] = useState<'solo' | 'team' | 'hybrid'>('hybrid');
  const [newBotProviderId, setNewBotProviderId] = useState('deepseek');
  const [newBotModel, setNewBotModel] = useState('deepseek-chat');
  const [newBotFallbackProviderId, setNewBotFallbackProviderId] = useState('local-glm-88');
  const [newBotFallbackModel, setNewBotFallbackModel] = useState('glm-5.2-think');
  const [newBotAutoClone, setNewBotAutoClone] = useState(true);
  const [newBotMaxClones, setNewBotMaxClones] = useState(3);
  const [newBotAutonomousEnabled, setNewBotAutonomousEnabled] = useState(true);
  const [newBotAutonomousInterval, setNewBotAutonomousInterval] = useState(15);
  const [newBotAutonomousGoal, setNewBotAutonomousGoal] = useState('');
  const [newBotPrompt, setNewBotPrompt] = useState('คุณคือบอทผู้ช่วยอัจฉริยะ ทำหน้าที่ตามบทบาทที่ได้รับมอบหมาย');

  const fetchData = async () => {
    try {
      const [bRes, gRes, pRes, aRes, brRes] = await Promise.all([
        fetch('/api/bots'),
        fetch('/api/groups'),
        fetch('/api/ai-providers'),
        fetch('/api/autonomous'),
        fetch('/api/broker'),
      ]);
      const bData = await bRes.json();
      const gData = await gRes.json();
      const pData = await pRes.json();
      const aData = aRes.ok ? await aRes.json() : null;
      const brData = brRes.ok ? await brRes.json() : null;

      // Broker ล่ม → ล้างข้อมูลเก่าทิ้ง ไม่ให้หน้าจอค้างสถานะ 'เชื่อมต่อแล้ว'
      setBrokerData(brData?.success ? brData : null);

      if (bData.success) {
        setBots(bData.data);
        // functional update: interval จับ selectedId ตอน mount (ค่าว่าง) ไว้ → เดิมเด้งกลับบอทตัวแรกและล้างค่าที่แก้ค้างใน Inspector ทุก 20 วิ
        if (bData.data.length > 0) setSelectedId((prev) => prev || bData.data[0].id);
      }
      if (gData.success) setGroups(gData.data);
      if (pData.success) setProviders(pData.data);
      if (aData?.success && aData.data?.recentLogs) {
        setGlobalLogs(aData.data.recentLogs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-polling: อัปเดตข้อมูลอัตโนมัติทุก 20 วินาที คนแค่มาดู
    const timer = setInterval(() => {
      fetchData();
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  const currentBot = bots.find((b) => b.id === selectedId);
  const currentGroup = groups.find((g) => g.id === selectedId);
  const redisOk = Boolean(brokerData?.broker?.redis?.connected);
  const kafkaOk = Boolean(brokerData?.broker?.kafka?.connected);
  const brokerNodes: any[] = brokerData?.nodes || [];

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else terminalRef.current?.requestFullscreen().catch(() => {});
  };

  const refreshFrame = () => {
    setFrameLoading(true);
    setFrameKey((k) => k + 1);
  };

  // Sync inspector when selecting another bot
  useEffect(() => {
    if (selectedType === 'bot' && currentBot) {
      setInspectorPrompt(currentBot.systemPrompt);
      setInspectorTemp(currentBot.temperature);
      setInspectorModel(currentBot.modelName);
      setInspectorProviderId(currentBot.providerId || 'deepseek');
      setInspectorFallbackModel(currentBot.fallbackModelName || '');
      setInspectorFallbackProviderId(currentBot.fallbackProviderId || '');
      setInspectorAutoClone(currentBot.autoCloneEnabled !== false);
      setInspectorMaxClones(currentBot.maxClones || 3);
      setInspectorAutonomousEnabled(currentBot.autonomousEnabled !== false);
      setInspectorAutonomousInterval(currentBot.autonomousIntervalMinutes || 15);
      setInspectorAutonomousGoal(currentBot.autonomousGoal || currentBot.description || '');
    }
  }, [selectedId, selectedType]);

  const activeMessages = chatMessages[selectedId] || [];

  const pushSystemMessage = (targetId: string, content: string) => {
    setChatMessages((prev) => ({
      ...prev,
      [targetId]: [
        ...(prev[targetId] || []),
        {
          id: `sys-${Date.now()}`,
          botId: 'system',
          senderName: 'ระบบ',
          avatar: '⚠️',
          sender: 'system',
          content,
          timestamp: new Date().toISOString(),
        },
      ],
    }));
  };

  const sendChat = async (text: string) => {
    const promptText = text.trim();
    if (!promptText || !selectedId || sending) return;
    // จับเป้าหมายไว้ก่อน await: ผู้ใช้สลับบอทระหว่างรอ คำตอบต้องไปลงห้องเดิม
    const targetId = selectedId;
    const targetType = selectedType;
    const history = chatMessages[targetId] || [];

    const userMsg: BotMessage = {
      id: `user-${Date.now()}`,
      groupId: targetType === 'group' ? targetId : undefined,
      botId: 'user',
      senderName: 'ลุงจืด',
      avatar: '👨‍💼',
      sender: 'user',
      content: promptText,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => ({ ...prev, [targetId]: [...(prev[targetId] || []), userMsg] }));
    setInputPrompt('');
    setSending(true);

    try {
      const endpoint = targetType === 'bot' ? `/api/bots/${targetId}/chat` : `/api/groups/${targetId}/chat`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: promptText, history }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        const newReplies = Array.isArray(data.data) ? data.data : [data.data];
        setChatMessages((prev) => ({ ...prev, [targetId]: [...(prev[targetId] || []), ...newReplies] }));
      } else {
        // เดิมเงียบ: ผู้ใช้เห็นข้อความตัวเองแล้วไม่มีอะไรตอบกลับ
        pushSystemMessage(targetId, `ส่งคำสั่งไม่สำเร็จ: ${data?.error || `HTTP ${res.status}`}`);
      }
    } catch (err: any) {
      pushSystemMessage(targetId, `เชื่อมต่อศูนย์ควบคุมไม่ได้: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    sendChat(inputPrompt);
  };

  // อนุมัติ Draft (Human-in-the-loop): ส่งงานข้ามจังหวัดเข้า Kafka จริง หรือส่งคำอนุมัติกลับให้บอทดำเนินการต่อ
  // เดิมเป็น alert() เฉย ๆ ไม่มีอะไรเกิดขึ้นจริง
  const handleApproveDraft = async (targetId: string, msg: BotMessage) => {
    const draft = msg.draftAction;
    if (!draft || draft.approved) return;
    const markApproved = (patch: Partial<BotMessage> = {}) =>
      setChatMessages((prev) => ({
        ...prev,
        [targetId]: (prev[targetId] || []).map((m) =>
          m.id === msg.id ? { ...m, ...patch, draftAction: { ...draft, approved: true } } : m
        ),
      }));

    if (draft.type === 'cross_province_dispatch' && draft.dispatches?.length) {
      const results = await Promise.all(
        draft.dispatches.map(async (d) => {
          const res = await fetch('/api/broker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send',
              topic: 'smlbot.tasks',
              message: { fromBotId: msg.botId, toBotId: d.toBotId, action: 'task', payload: { task: d.task, requestedBy: 'user-approval' } },
            }),
          }).catch(() => null);
          const data = await res?.json().catch(() => null);
          const toBotName = brokerNodes.find((n) => n.botId === d.toBotId)?.botName || d.toBotId;
          return { toBotId: d.toBotId, toBotName, task: d.task, ok: Boolean(data?.success) };
        })
      );
      markApproved({ dispatchResults: results });
      return;
    }

    markApproved();
    await sendChat(`✅ อนุมัติแล้ว: ${draft.title} — ดำเนินการต่อได้เลย`);
  };

  // VM Action: Start / Stop / Restart / Deploy
  const handleVMControl = async (action: 'deploy' | 'start' | 'stop' | 'restart') => {
    if (!currentBot) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/bots/${currentBot.id}/vm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        alert(data.error || 'เกิดข้อผิดพลาดในการสั่งการ VM');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Spawn a new clone VM manually or for test
  const handleSpawnClone = async () => {
    if (!currentBot) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/bots/${currentBot.id}/vm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'spawn_clone' }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        alert(data.error || 'ไม่สามารถสร้าง Clone ได้');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Remove a clone VM
  const handleRemoveClone = async (cloneId: string) => {
    if (!currentBot) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/bots/${currentBot.id}/vm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_clone', cloneId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        alert(data.error || 'ไม่สามารถลบ Clone ได้');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Busy simulation
  const handleToggleBusy = async () => {
    if (!currentBot) return;
    try {
      const newBusy = !currentBot.isBusy;
      const res = await fetch(`/api/bots/${currentBot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isBusy: newBusy,
          activeTask: newBusy ? 'งานประมวลผล (สถานะไม่ว่าง / Auto-Clone ทำงาน)' : undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.success) alert(`เปลี่ยนสถานะไม่สำเร็จ: ${data?.error || res.status}`);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Trigger on-demand Autonomous Cycle
  const handleTriggerAutonomous = async () => {
    setAutonomousRunning(true);
    try {
      const res = await fetch('/api/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceAll: true }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        await fetchData();
      } else {
        alert(data?.error || 'รันรอบงานไม่สำเร็จ');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAutonomousRunning(false);
    }
  };

  // Save changes from inspector panel (คนแค่กำหนดค่าและปรับปรุงคำสั่ง)
  const handleSaveInspector = async () => {
    if (!currentBot) return;
    setInspectorSaving(true);
    try {
      const res = await fetch(`/api/bots/${currentBot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: inspectorPrompt,
          temperature: inspectorTemp,
          providerId: inspectorProviderId,
          modelName: inspectorModel,
          // ส่ง '' ไม่ใช่ undefined: undefined หายจาก JSON → เดิมกดปิดสมองกลสำรองแล้วไม่ถูกบันทึก
          fallbackProviderId: inspectorFallbackProviderId,
          fallbackModelName: inspectorFallbackModel,
          autoCloneEnabled: inspectorAutoClone,
          maxClones: inspectorMaxClones,
          autonomousEnabled: inspectorAutonomousEnabled,
          autonomousIntervalMinutes: inspectorAutonomousInterval,
          autonomousGoal: inspectorAutonomousGoal,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
        alert('บันทึกการปรับปรุงคำสั่งและค่าคอนฟิกเรียบร้อย');
      } else {
        alert(`บันทึกไม่สำเร็จ: ${data.error}`);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInspectorSaving(false);
    }
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotName.trim() || !newBotRole.trim() || creatingBot) return;
    setCreatingBot(true);

    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBotName,
          role: newBotRole,
          avatar: newBotAvatar,
          workMode: newBotWorkMode,
          providerId: newBotProviderId,
          modelName: newBotModel,
          fallbackProviderId: newBotFallbackProviderId || undefined,
          fallbackModelName: newBotFallbackModel || undefined,
          systemPrompt: newBotPrompt,
          autoCloneEnabled: newBotAutoClone,
          maxClones: newBotMaxClones,
          autonomousEnabled: newBotAutonomousEnabled,
          autonomousIntervalMinutes: newBotAutonomousInterval,
          autonomousGoal: newBotAutonomousGoal || newBotRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddBotModal(false);
        setNewBotName('');
        setNewBotRole('');
        await fetchData();
        setSelectedId(data.data.id);
        setSelectedType('bot');
        if (data.vmError) alert(`สร้างบอทแล้ว แต่ Deploy VM ไม่สำเร็จ: ${data.vmError}\nกด Deploy ใหม่ได้จากแผงควบคุม`);
      } else {
        alert(`สร้างบอทไม่สำเร็จ: ${data.error}`);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingBot(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[75vh] flex-col items-center justify-center gap-3 text-neutral-400">
        <div className="relative flex h-12 w-12 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-indigo-500/20" />
          <Bot className="h-6 w-6 animate-pulse text-indigo-500" />
        </div>
        <span className="text-xs font-medium tracking-wide">กำลังเชื่อมต่อศูนย์ควบคุม SML Bot...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Bar: Single Control Center Header & Global Server Status */}
      <div className="glass-panel relative overflow-hidden rounded-2xl p-4 transition-all">
        <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                  ศูนย์ควบคุมหลัก SML Bot (Unified Command Center)
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  ควบคุมจุดเดียว
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                บริหารจัดการกองทัพบอท 24/7 Agent Zero VMs บนเซิร์ฟเวอร์หลัก (Core Engine)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* โครงข่ายข้ามจังหวัด (Kafka + Redis Central Broker) */}
            <button
              onClick={() => setShowBrokerModal(true)}
              className="group flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-700 backdrop-blur-md dark:border-indigo-500/40 dark:bg-indigo-950/40 dark:text-indigo-300 hover:border-indigo-500 transition-all hover:scale-[1.02]"
              title="คลิกดูโครงข่ายสื่อสารบอทข้ามจังหวัด (Central Broker Hub)"
            >
              <Radio className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
              <span className="font-bold">โครงข่ายข้ามจังหวัด</span>
              <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                Cloud Hub
              </span>
            </button>

            <div className="flex items-center gap-2 rounded-xl border border-neutral-200/80 bg-white/60 px-3 py-1.5 text-xs text-neutral-700 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/60 dark:text-neutral-300">
              <Server className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-medium">เซิร์ฟเวอร์หลัก</span>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
            </div>

            <button
              onClick={() => setShowAddBotModal(true)}
              className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-300 hover:scale-[1.02] active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>สร้าง Bot ใหม่ (Auto VM)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main 3-Pane Unified Grid Layout */}
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-170px)] min-h-[580px]">
        {/* ============================================================== */}
        {/* PANE 1 (LEFT): Bot & Team Selector Sidebar (3 cols)             */}
        {/* ============================================================== */}
        <div className="glass-panel col-span-12 lg:col-span-3 flex flex-col rounded-2xl overflow-hidden transition-all">
          <div className="border-b border-neutral-200/60 p-3.5 dark:border-neutral-800/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                กองทัพ Bot (24/7 VMs)
              </span>
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                {bots.length} ตัว
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {/* Bots List */}
            {bots.map((bot) => {
              const isSelected = selectedType === 'bot' && selectedId === bot.id;
              const isRunning = bot.vmConfig?.status === 'running';

              return (
                <button
                  key={bot.id}
                  onClick={() => {
                    setSelectedType('bot');
                    setSelectedId(bot.id);
                  }}
                  className={`w-full text-left rounded-xl p-3 transition-all duration-200 flex items-center justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-gradient-to-r from-indigo-500/15 to-purple-500/10 border border-indigo-500/40 shadow-xs dark:from-indigo-950/60 dark:to-purple-950/40 dark:border-indigo-500/50'
                      : 'hover:bg-neutral-100/60 border border-transparent dark:hover:bg-neutral-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-xs dark:bg-neutral-800 animate-float">
                      {bot.avatar}
                      {isRunning && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900" />
                        </span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-neutral-900 dark:text-white">
                        {bot.name}
                      </div>
                      <div className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                        {bot.modelName} • {bot.workMode === 'solo' ? 'เดี่ยว 24/7' : bot.workMode === 'team' ? 'สมาชิกทีม' : 'เดี่ยว/ทีม'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isRunning
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-neutral-500/10 text-neutral-500'
                      }`}
                    >
                      {isRunning ? '24/7' : 'OFF'}
                    </span>
                    {bot.isBusy && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse">
                        ติดงาน
                      </span>
                    )}
                    {bot.clones && bot.clones.length > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-600 dark:text-purple-400">
                        👥 x{bot.clones.length} Clone
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Groups / Teams Header */}
            <div className="pt-4 pb-1.5 px-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                ห้องทีมทำงานร่วม (Multi-Bot)
              </span>
              <span className="text-[10px] text-neutral-400 font-bold">{groups.length}</span>
            </div>

            {/* Groups List */}
            {groups.map((group) => {
              const isSelected = selectedType === 'group' && selectedId === group.id;

              return (
                <button
                  key={group.id}
                  onClick={() => {
                    setSelectedType('group');
                    setSelectedId(group.id);
                  }}
                  className={`w-full text-left rounded-xl p-3 transition-all duration-200 flex items-center justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-gradient-to-r from-purple-500/15 to-pink-500/10 border border-purple-500/40 shadow-xs dark:from-purple-950/60 dark:to-pink-950/40 dark:border-purple-500/50'
                      : 'hover:bg-neutral-100/60 border border-transparent dark:hover:bg-neutral-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-xl shadow-xs dark:bg-purple-950/80">
                      {group.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-neutral-900 dark:text-white">
                        {group.name}
                      </div>
                      <div className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                        สมาชิก {group.memberBotIds.length} ตัว
                      </div>
                    </div>
                  </div>
                  <Users className="h-4 w-4 text-neutral-400" />
                </button>
              );
            })}
          </div>
        </div>

        {/* ============================================================== */}
        {/* PANE 2 (CENTER): Live Command & Conversation Studio (6 cols)    */}
        {/* ============================================================== */}
        <div className="glass-panel col-span-12 lg:col-span-6 flex flex-col rounded-2xl overflow-hidden transition-all">
          {/* Header of Active Bot or Team */}
          <div className="flex items-center justify-between border-b border-neutral-200/60 px-4 py-3 dark:border-neutral-800/60">
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-float">
                {selectedType === 'bot' ? currentBot?.avatar : currentGroup?.icon}
              </span>
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {selectedType === 'bot' ? currentBot?.name : currentGroup?.name}
                </h2>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {selectedType === 'bot'
                    ? `${currentBot?.role} • AI: ${currentBot?.modelName}`
                    : `ทีมทำงานร่วม • โหมด: ${currentGroup?.collaborationMode}`}
                </p>
              </div>
            </div>

            {/* View Mode Toggle: Monitor (คนแค่มาดู) vs Chat (สั่งการ) vs Live VM */}
            {selectedType === 'bot' && (
              <div className="flex items-center rounded-xl border border-neutral-200/80 bg-neutral-100/70 p-1 text-xs dark:border-neutral-800 dark:bg-neutral-900/80">
                <button
                  onClick={() => setViewMode('monitor')}
                  data-tip="ดูบอททำงานอัตโนมัติแบบสด"
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all ${
                    viewMode === 'monitor'
                      ? 'bg-white text-indigo-600 shadow-xs dark:bg-neutral-800 dark:text-indigo-400'
                      : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400'
                  }`}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>เรดาห์สด (Auto)</span>
                </button>
                <button
                  onClick={() => setViewMode('chat')}
                  data-tip="พิมพ์สั่งงานบอทโดยตรง"
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all ${
                    viewMode === 'chat'
                      ? 'bg-white text-indigo-600 shadow-xs dark:bg-neutral-800 dark:text-indigo-400'
                      : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>สั่งการ</span>
                </button>
                {!!currentBot?.vmConfig?.hostPort && (
                  <button
                    onClick={() => setViewMode('terminal')}
                    data-tip="หน้าจอ Agent Zero ของบอทตัวนี้"
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all ${
                      viewMode === 'terminal'
                        ? 'bg-white text-indigo-600 shadow-xs dark:bg-neutral-800 dark:text-indigo-400'
                        : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400'
                    }`}
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    <span>Live VM</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Center Content: Either Monitor View, Terminal View, or Chat Feed */}
          {viewMode === 'monitor' && selectedType === 'bot' ? (
            <div className="animate-view-in flex-1 flex flex-col overflow-hidden p-4 space-y-3.5">
              {/* Top Banner: Autonomous Status & Trigger Button */}
              <div className="flex items-center justify-between rounded-xl border border-indigo-500/25 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/5 p-3 text-xs dark:border-indigo-500/30">
                <div className="flex items-center gap-2.5">
                  <span className="radar-scanner h-9 w-9 shrink-0" aria-hidden="true" />
                  <div>
                    <span className="font-bold text-neutral-900 dark:text-white block">
                      โหมด Autonomous 24/7 (คนแค่มาดู)
                    </span>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      รอบการวนทำงาน: ทุก {currentBot?.autonomousIntervalMinutes || 15} นาที • รันล่าสุด:{' '}
                      {currentBot?.lastAutonomousRunAt
                        ? new Date(currentBot.lastAutonomousRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'เพิ่งเริ่มระบบ'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleTriggerAutonomous}
                  disabled={autonomousRunning}
                  type="button"
                  className="btn-ripple inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:opacity-95 disabled:opacity-50 transition-all active:scale-95"
                >
                  {autonomousRunning ? <span className="pulse-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span> : <Zap className="h-3.5 w-3.5" />}
                  <span>{autonomousRunning ? 'AI กำลังคิดรอบงาน...' : 'รันรอบงานเดี๋ยวนี้'}</span>
                </button>
              </div>

              {/* Goal Card */}
              <div className="neon-card rounded-xl border border-neutral-200/70 bg-white/70 p-3 text-xs dark:border-neutral-800/70 dark:bg-neutral-900/70 space-y-1">
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                  🎯 เป้าหมายภารกิจต่อเนื่อง (Autonomous Goal):
                </span>
                <p className="text-xs text-neutral-800 dark:text-neutral-200 font-medium leading-relaxed">
                  {currentBot?.autonomousGoal || currentBot?.description || 'ปฏิบัติหน้าที่ประจำบทบาทอย่างต่อเนื่อง'}
                </p>
              </div>

              {/* Activity Log Feed */}
              <div className="flex-1 flex flex-col min-h-0 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    ประวัติกิจกรรมและการปฏิบัติภารกิจสด ({currentBot?.activityLogs?.length || 0})
                  </span>
                  <span className="live-dot text-[10px] text-neutral-400">ฟีดสด 24/7</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {(!currentBot?.activityLogs || currentBot.activityLogs.length === 0) ? (
                    <div className="flex h-48 flex-col items-center justify-center text-center text-xs text-neutral-400 space-y-2 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
                      <Activity className="h-6 w-6 text-indigo-400 animate-pulse" />
                      <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                        ระบบ Autonomous ทำงานอยู่เบื้องหลัง
                      </p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 max-w-xs">
                        บอทกำลังเฝ้าระวังและเตรียมประมวลผลตามรอบ หรือกดปุ่ม &quot;⚡ รันรอบงานเดี๋ยวนี้&quot; ด้านบนเพื่อดูบอททำงานทันที
                      </p>
                    </div>
                  ) : (
                    currentBot.activityLogs.map((log, idx) => (
                      <div
                        key={log.id}
                        style={{ animationDelay: `${Math.min(idx, 8) * 45}ms` }}
                        className="animate-stream-in neon-card rounded-xl border border-neutral-200/70 bg-white/80 p-3 text-xs dark:border-neutral-800/70 dark:bg-neutral-900/80 space-y-1.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                log.actionType === 'self_heal'
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                  : log.actionType === 'clone_spawn'
                                  ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                                  : log.actionType === 'failover'
                                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                  : log.status === 'error'
                                  ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {log.actionType === 'self_heal' && '⚠️ Self-Healing'}
                              {log.actionType === 'clone_spawn' && '👥 Auto-Clone แยก VM'}
                              {log.actionType === 'failover' && '🛡️ Failover สลับโมเดล'}
                              {log.actionType === 'autonomous_run' && '⚡ ภารกิจอัตโนมัติ'}
                              {log.actionType === 'user_directive' && '🧑‍💼 คำสั่งจากผู้ใช้'}
                              {log.actionType === 'task_complete' && '✅ งานเสร็จสิ้น'}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-neutral-400">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>

                        <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed font-normal">
                          {log.summary}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : viewMode === 'terminal' && selectedType === 'bot' && currentBot?.vmConfig?.hostPort ? (
            <div ref={terminalRef} className="animate-view-in flex-1 w-full bg-neutral-950 flex flex-col overflow-hidden">
              {/* Terminal Header Control Bar */}
              <div className="flex items-center justify-between px-3.5 py-2 bg-neutral-900 border-b border-neutral-800 text-xs shrink-0">
                <div className="flex items-center gap-2 text-neutral-300">
                  <Terminal className="h-4 w-4 text-emerald-400" />
                  <span className="font-semibold text-white">Agent Zero Live Console:</span>
                  <span className="font-mono text-emerald-400 text-[11px] bg-neutral-800 px-2 py-0.5 rounded">
                    พอร์ตโฮสต์: {currentBot.vmConfig.hostPort}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={refreshFrame}
                    data-tip="โหลดหน้าจอ Agent Zero ใหม่"
                    className="btn-ripple inline-flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors"
                  >
                    <RotateCw className={`h-3 w-3 ${frameLoading ? 'animate-spin' : ''}`} />
                    <span>รีเฟรชหน้าจอ</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    data-tip={isFullscreen ? 'ออกจากโหมดเต็มจอ (Esc)' : 'ขยายเต็มจอ'}
                    className="btn-ripple inline-flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors"
                  >
                    {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                    <span>{isFullscreen ? 'ย่อหน้าจอ' : 'เต็มจอ'}</span>
                  </button>
                  <a
                    href={typeof window !== 'undefined' ? `http://${window.location.hostname}:${currentBot.vmConfig.hostPort}` : `http://localhost:${currentBot.vmConfig.hostPort}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white hover:bg-indigo-500 shadow-xs transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>เปิด Agent Zero [↗]</span>
                  </a>
                </div>
              </div>
              <div className="relative flex-1">
                <iframe
                  key={`${currentBot.id}-${frameKey}`}
                  src={typeof window !== 'undefined' ? `http://${window.location.hostname}:${currentBot.vmConfig.hostPort}` : `http://localhost:${currentBot.vmConfig.hostPort}`}
                  onLoad={() => setFrameLoading(false)}
                  className={`absolute inset-0 h-full w-full border-0 bg-neutral-950 transition-opacity duration-500 ${frameLoading ? 'opacity-0' : 'opacity-100'}`}
                  title="Agent Zero Live Interface"
                />
                {frameLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-xs text-emerald-400">
                    <span className="radar-scanner h-14 w-14" aria-hidden="true" />
                    <span>กำลังเชื่อมต่อ Agent Zero พอร์ต {currentBot.vmConfig.hostPort}...</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="animate-view-in flex-1 flex flex-col overflow-hidden">
              {/* Message History Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {activeMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-xs text-neutral-400 space-y-3">
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 shadow-inner">
                      <Sparkles className="h-7 w-7 animate-float text-indigo-500" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-neutral-800 dark:text-neutral-200">
                        ศูนย์สั่งการพร้อมรับคำสั่ง
                      </p>
                      <p className="text-neutral-500 dark:text-neutral-400 max-w-sm mt-1">
                        {selectedType === 'bot'
                          ? `พิมพ์คำสั่งเพื่อมอบหมายงานให้ ${currentBot?.name} บอทจะประมวลผลผ่านโมเดล ${currentBot?.modelName} บน VM 24/7`
                          : `พิมพ์โจทย์เพื่อให้ทีมบอทแตกงานและร่วมมือกันประสานผลลัพธ์`}
                      </p>
                    </div>
                  </div>
                ) : (
                  activeMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`animate-stream-in flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.sender !== 'user' && (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-base shadow-xs dark:bg-neutral-800">
                          {msg.avatar}
                        </span>
                      )}

                      <div className="max-w-[82%] space-y-1">
                        <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                          <span className="font-bold text-neutral-700 dark:text-neutral-300">
                            {msg.senderName}
                          </span>
                          <span>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div
                          className={`whitespace-pre-wrap rounded-2xl p-3.5 text-xs leading-relaxed shadow-xs ${
                            msg.sender === 'user'
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                              : msg.sender === 'system'
                              ? 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50'
                              : 'bg-white/80 dark:bg-neutral-800/80 text-neutral-900 dark:text-neutral-100 border border-neutral-200/50 dark:border-neutral-700/50'
                          }`}
                        >
                          {msg.content}
                        </div>

                        {/* Clone Badge & Fallback Badge */}
                        {(msg.cloneInfo?.isClone || msg.usedFallback) && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {msg.cloneInfo?.isClone && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                                <Users className="h-3 w-3" />
                                <span>👥 รับงานโดย Clone #{msg.cloneInfo.cloneIndex} (ตัวหลักไม่ว่าง)</span>
                              </div>
                            )}
                            {msg.usedFallback && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                <ShieldCheck className="h-3 w-3" />
                                <span>🛡️ สลับใช้สมองกลสำรอง: {msg.usedModel}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ผลส่งภารกิจข้ามจังหวัด (Kafka smlbot.tasks) */}
                        {msg.dispatchResults && (
                          <div className="mt-2 space-y-1">
                            {msg.dispatchResults.map((d, i) => (
                              <div
                                key={i}
                                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold ${
                                  d.ok
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                    : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'
                                }`}
                              >
                                <Radio className="h-3 w-3 shrink-0" />
                                <span>{d.ok ? '📡 ส่งภารกิจข้ามจังหวัดแล้ว' : '❌ ส่งภารกิจไม่สำเร็จ (Cloud Hub ไม่ตอบสนอง)'} → {d.toBotName}: {d.task}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action Draft Card (Human-in-the-loop) */}
                        {msg.draftAction && (
                          <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-50/70 p-3 text-xs dark:border-amber-900/50 dark:bg-amber-950/40 space-y-2 backdrop-blur-xs">
                            <div className="flex items-center justify-between text-amber-900 dark:text-amber-300 font-bold">
                              <span>⚡ {msg.draftAction.title}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${msg.draftAction.approved ? 'bg-emerald-200/80 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200' : 'bg-amber-200/80 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200'}`}>
                                {msg.draftAction.approved ? 'อนุมัติแล้ว' : 'รออนุมัติ'}
                              </span>
                            </div>
                            <p className="whitespace-pre-line text-[11px] text-amber-800 dark:text-amber-200/80">
                              {msg.draftAction.details}
                            </p>
                            <div className="flex justify-end pt-1">
                              <button
                                onClick={() => handleApproveDraft(selectedId, msg)}
                                disabled={msg.draftAction.approved || sending}
                                className="btn-ripple inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-500 disabled:opacity-50 transition-colors"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                <span>
                                  {msg.draftAction.approved
                                    ? 'อนุมัติแล้ว'
                                    : msg.draftAction.type === 'cross_province_dispatch'
                                    ? 'อนุมัติและส่งภารกิจ'
                                    : 'อนุมัติคำสั่งนี้'}
                                </span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {msg.sender === 'user' && (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-base shadow-xs dark:bg-indigo-950">
                          {msg.avatar}
                        </span>
                      )}
                    </div>
                  ))
                )}
                {sending && (
                  <div className="animate-stream-in flex items-center gap-2.5 text-xs text-neutral-400 italic">
                    <span className="pulse-wave text-indigo-500" aria-hidden="true"><i /><i /><i /><i /><i /></span>
                    <span>AI กำลังคิดและประมวลผลบนเซิร์ฟเวอร์หลัก...</span>
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-2 border-t border-neutral-200/60 p-3 dark:border-neutral-800/60 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-md"
              >
                <input
                  type="text"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  placeholder={`สั่งการ ${selectedType === 'bot' ? currentBot?.name : currentGroup?.name}...`}
                  className="flex-1 rounded-xl border border-neutral-200/80 bg-white/80 px-3.5 py-2 text-xs dark:border-neutral-700/80 dark:bg-neutral-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <button
                  type="submit"
                  disabled={sending || !inputPrompt.trim()}
                  className="btn-ripple inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-xs"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>ส่ง</span>
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* PANE 3 (RIGHT): Bot Inspector & 24/7 VM Controller (3 cols)     */}
        {/* ============================================================== */}
        <div className="glass-panel col-span-12 lg:col-span-3 flex flex-col rounded-2xl overflow-hidden transition-all">
          <div className="border-b border-neutral-200/60 p-3.5 dark:border-neutral-800/60 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-indigo-500" />
              <span>แผงควบคุมคุณสมบัติ (Inspector)</span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            {selectedType === 'bot' && currentBot ? (
              <>
                {/* Autonomous 24/7 Configuration (คนแค่กำหนดค่าและปรับปรุงคำสั่ง) */}
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3.5 text-xs dark:border-indigo-900/50 dark:bg-indigo-950/20 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>โหมด Autonomous 24/7 (บอทรันเอง)</span>
                    </span>
                    <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                      Auto ทุกอย่าง
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                        เปิดการวนรอบทำงานอัตโนมัติ:
                      </span>
                      <input
                        type="checkbox"
                        checked={inspectorAutonomousEnabled}
                        onChange={(e) => setInspectorAutonomousEnabled(e.target.checked)}
                        className="h-4 w-4 rounded accent-indigo-600"
                      />
                    </label>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-700 dark:text-neutral-300">ความถี่รอบ (นาที):</span>
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        value={inspectorAutonomousInterval}
                        onChange={(e) => setInspectorAutonomousInterval(parseInt(e.target.value, 10) || 15)}
                        className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-center font-mono dark:border-neutral-700 dark:bg-neutral-800"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                          🎯 เป้าหมายภารกิจ (Autonomous Goal):
                        </label>
                      </div>
                      <textarea
                        rows={2}
                        value={inspectorAutonomousGoal}
                        onChange={(e) => setInspectorAutonomousGoal(e.target.value)}
                        placeholder="สิ่งที่บอทต้องเฝ้าระวังหรือปฏิบัติการเองต่อเนื่อง..."
                        className="w-full rounded-xl border border-neutral-300 p-2 text-[11px] leading-relaxed dark:border-neutral-700 dark:bg-neutral-800"
                      />
                    </div>
                  </div>
                </div>

                {/* 24/7 VM Container Status & Controls */}
                <div className="rounded-xl border border-neutral-200/70 bg-white/60 p-3.5 text-xs dark:border-neutral-800/70 dark:bg-neutral-950/60 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-800 dark:text-neutral-200">
                      สถานะ VM 24/7 (Agent Zero)
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        currentBot.vmConfig?.status === 'running'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-neutral-500/15 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${currentBot.vmConfig?.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'}`} />
                      {currentBot.vmConfig?.status === 'running' ? 'ออนไลน์ 24/7' : 'หยุดทำงาน'}
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <div className="flex justify-between">
                      <span>คอนเทนเนอร์:</span>
                      <span className="font-mono text-neutral-800 dark:text-neutral-200">
                        {currentBot.vmConfig?.containerName || 'ยังไม่ได้ Deploy'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>พอร์ตโฮสต์:</span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-white">
                        {currentBot.vmConfig?.hostPort ? `พอร์ต ${currentBot.vmConfig.hostPort} (Private Host)` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* VM Action Buttons */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {!currentBot.vmConfig?.containerName ? (
                      <button
                        onClick={() => handleVMControl('deploy')}
                        disabled={actionLoading}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        <Server className="h-3.5 w-3.5" />
                        <span>Deploy VM ทันที (24/7)</span>
                      </button>
                    ) : (
                      <>
                        {currentBot.vmConfig.status === 'running' ? (
                          <button
                            onClick={() => handleVMControl('stop')}
                            disabled={actionLoading}
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
                          >
                            <Square className="h-3 w-3 fill-current" />
                            <span>หยุด</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleVMControl('start')}
                            disabled={actionLoading}
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
                          >
                            <Play className="h-3 w-3 fill-current" />
                            <span>สตาร์ท</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleVMControl('restart')}
                          disabled={actionLoading}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-neutral-300 bg-white py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                        >
                          <RotateCw className="h-3 w-3" />
                          <span>รีสตาร์ท</span>
                        </button>
                      </>
                    )}
                  </div>

                  {currentBot.vmConfig?.hostPort && (
                    <a
                      href={typeof window !== 'undefined' ? `http://${window.location.hostname}:${currentBot.vmConfig.hostPort}` : `http://localhost:${currentBot.vmConfig.hostPort}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-400 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>เปิด Agent Zero [↗]</span>
                    </a>
                  )}
                </div>

                {/* Auto-Clone & Dynamic VM Scaling */}
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3.5 text-xs dark:border-purple-900/50 dark:bg-purple-950/20 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      <span>ระบบ Auto-Clone เมื่อไม่ว่าง</span>
                    </span>
                    <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[9px] font-bold text-purple-600 dark:text-purple-400">
                      Dynamic VM
                    </span>
                  </div>

                  {/* Toggle Auto-Clone and Max Clones */}
                  <div className="space-y-2">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-[11px] text-neutral-700 dark:text-neutral-300">เปิด Clone อัตโนมัติ:</span>
                      <input
                        type="checkbox"
                        checked={inspectorAutoClone}
                        onChange={(e) => setInspectorAutoClone(e.target.checked)}
                        className="h-4 w-4 rounded accent-purple-600"
                      />
                    </label>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-700 dark:text-neutral-300">จำนวน Clone สูงสุด:</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={inspectorMaxClones}
                        onChange={(e) => setInspectorMaxClones(parseInt(e.target.value, 10) || 1)}
                        className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-center font-mono dark:border-neutral-700 dark:bg-neutral-800"
                      />
                    </div>
                  </div>

                  {/* Bot Work Status & Busy Simulation */}
                  <div className="rounded-lg border border-neutral-200/60 bg-white/70 p-2.5 dark:border-neutral-800/60 dark:bg-neutral-900/70 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-500 dark:text-neutral-400">สถานะคิวงาน:</span>
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          currentBot.isBusy
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${currentBot.isBusy ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                        {currentBot.isBusy ? 'กำลังติดภารกิจ (Busy)' : 'ว่าง พร้อมรับงาน (Idle)'}
                      </span>
                    </div>

                    <button
                      onClick={handleToggleBusy}
                      type="button"
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-neutral-100/80 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-200/70 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 transition-colors"
                    >
                      <Zap className="h-3 w-3 text-amber-500" />
                      <span>{currentBot.isBusy ? 'ปลดสถานะเป็น "ว่างพร้อมรับงาน"' : 'ตั้งสถานะเป็น "ติดงาน" (ทดสอบระบบ Auto-Clone)'}</span>
                    </button>
                  </div>

                  {/* Active Clones List */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                      <span>VM Clones ที่รันอยู่ ({currentBot.clones?.length || 0}):</span>
                      <button
                        onClick={handleSpawnClone}
                        disabled={actionLoading}
                        type="button"
                        className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                      >
                        <Plus className="h-2.5 w-2.5" />
                        <span>สร้าง Clone VM ทันที</span>
                      </button>
                    </div>

                    {(!currentBot.clones || currentBot.clones.length === 0) ? (
                      <p className="text-[10px] text-neutral-400 italic">
                        ยังไม่มี Clone VM (ระบบจะสร้างอัตโนมัติเมื่อสั่งงานขณะบอทติดงาน)
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {currentBot.clones.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between rounded-lg border border-purple-500/20 bg-white/50 p-2 text-[10px] dark:border-purple-900/30 dark:bg-neutral-900/50"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-neutral-800 dark:text-neutral-200">
                                Clone #{c.cloneIndex} (Port {c.hostPort})
                              </div>
                              <div className="truncate font-mono text-neutral-400 text-[9px]">
                                {c.containerName}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <a
                                href={typeof window !== 'undefined' ? `http://${window.location.hostname}:${c.hostPort}` : `http://localhost:${c.hostPort}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded p-1 text-neutral-500 hover:text-indigo-600 hover:bg-neutral-200/50 dark:hover:bg-neutral-800"
                                title="เปิด Web UI ของ Clone"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                              <button
                                onClick={() => handleRemoveClone(c.id)}
                                disabled={actionLoading}
                                className="rounded p-1 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                                title="ปิดและลบ Clone VM นี้"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary AI Brain Selection */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-neutral-800 dark:text-neutral-200">
                      ⚡ สมองกลหลัก (Primary AI)
                    </label>
                    <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                      ใช้งานเป็นอันดับแรก
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={inspectorProviderId}
                      onChange={(e) => {
                        const provId = e.target.value;
                        setInspectorProviderId(provId);
                        const p = providers.find((pr) => pr.id === provId);
                        if (p) setInspectorModel(p.defaultModel || p.availableModels[0] || 'default');
                      }}
                      className="rounded-xl border border-neutral-300 p-2 text-[11px] dark:border-neutral-700 dark:bg-neutral-800 font-medium"
                    >
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name.split(' ')[0]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={inspectorModel}
                      onChange={(e) => setInspectorModel(e.target.value)}
                      placeholder="เช่น deepseek-chat"
                      className="rounded-xl border border-neutral-300 p-2 text-[11px] font-mono dark:border-neutral-700 dark:bg-neutral-800"
                    />
                  </div>
                </div>

                {/* Backup / Fallback AI Selection */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-neutral-800 dark:text-neutral-200">
                      🛡️ สมองกลสำรอง (Backup / Fallback AI)
                    </label>
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      สลับอัตโนมัติเมื่อตัวหลักล่ม
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={inspectorFallbackProviderId}
                      onChange={(e) => {
                        const provId = e.target.value;
                        setInspectorFallbackProviderId(provId);
                        if (provId) {
                          const p = providers.find((pr) => pr.id === provId);
                          if (p) setInspectorFallbackModel(p.defaultModel || p.availableModels[0] || 'default');
                        } else {
                          setInspectorFallbackModel('');
                        }
                      }}
                      className="rounded-xl border border-neutral-300 p-2 text-[11px] dark:border-neutral-700 dark:bg-neutral-800 font-medium"
                    >
                      <option value="">(ไม่เปิดใช้สำรอง)</option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name.split(' ')[0]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={inspectorFallbackModel}
                      onChange={(e) => setInspectorFallbackModel(e.target.value)}
                      placeholder="เช่น deepseek-chat"
                      disabled={!inspectorFallbackProviderId}
                      className="rounded-xl border border-neutral-300 p-2 text-[11px] font-mono dark:border-neutral-700 dark:bg-neutral-800 disabled:opacity-40"
                    />
                  </div>
                </div>

                {/* Temperature */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="font-bold text-neutral-800 dark:text-neutral-200">
                      Temperature ({inspectorTemp})
                    </span>
                    <span className="text-[10px] text-neutral-400">0.0 (เป๊ะ) - 1.0 (คิดกว้าง)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={inspectorTemp}
                    onChange={(e) => setInspectorTemp(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>

                {/* System Instructions */}
                <div className="space-y-1.5 text-xs">
                  <label className="block font-bold text-neutral-800 dark:text-neutral-200">
                    คำสั่งกำกับพฤติกรรม (System Prompt)
                  </label>
                  <textarea
                    rows={5}
                    value={inspectorPrompt}
                    onChange={(e) => setInspectorPrompt(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 p-2.5 text-[11px] font-mono leading-relaxed dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>

                {/* Save Inspector Changes */}
                <button
                  onClick={handleSaveInspector}
                  disabled={inspectorSaving}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 text-xs font-bold text-white hover:opacity-95 disabled:opacity-50 transition-all shadow-md shadow-indigo-500/20 active:scale-95"
                >
                  <RefreshCw className={`h-3 w-3 ${inspectorSaving ? 'animate-spin' : ''}`} />
                  <span>{inspectorSaving ? 'กำลังบันทึก...' : 'บันทึกการปรับแต่ง'}</span>
                </button>
              </>
            ) : selectedType === 'group' && currentGroup ? (
              <div className="space-y-3.5 text-xs">
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3.5 dark:border-purple-900/40 dark:bg-purple-950/30">
                  <span className="font-bold text-purple-900 dark:text-purple-300 block mb-1">
                    ข้อมูลทีม: {currentGroup.name}
                  </span>
                  <p className="text-[11px] text-purple-800 dark:text-purple-200/80 leading-relaxed">
                    {currentGroup.description}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 block mb-2">
                    สมาชิกในทีม ({currentGroup.memberBotIds.length} ตัว)
                  </span>
                  <div className="space-y-2">
                    {currentGroup.memberBotIds.map((mId) => {
                      const b = bots.find((bot) => bot.id === mId);
                      return (
                        <div
                          key={mId}
                          className="flex items-center justify-between rounded-xl border border-neutral-200/60 p-2.5 dark:border-neutral-800/60 bg-white/40 dark:bg-neutral-900/40"
                        >
                          <div className="flex items-center gap-2">
                            <span>{b?.avatar || '🤖'}</span>
                            <span className="font-semibold">{b?.name || mId}</span>
                          </div>
                          {mId === currentGroup.leaderBotId && (
                            <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                              หัวหน้าทีม
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Modal: โครงข่ายบอทข้ามจังหวัด (Kafka & Redis บนโครงข่ายคลาวด์กลาง) */}
      {showBrokerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-indigo-500/30 bg-white p-5 shadow-2xl dark:border-indigo-500/40 dark:bg-neutral-900 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20">
                  <span className="radar-scanner h-7 w-7" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <span>โครงข่ายสื่อสารบอทข้ามจังหวัด (Cross-Province Hub)</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      redisOk && kafkaOk
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : redisOk || kafkaOk
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-red-500/15 text-red-600 dark:text-red-400'
                    }`}>
                      {redisOk && kafkaOk ? 'เชื่อมต่อครบ' : redisOk || kafkaOk ? 'เชื่อมต่อบางส่วน' : 'ขาดการเชื่อมต่อ'}
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    ศูนย์กลางกระจายงานผ่าน Kafka &amp; Redis บนโครงข่ายคลาวด์กลาง สำหรับบอทที่ไม่มี Fixed IP
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBrokerModal(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                ✕
              </button>
            </div>

            {/* Cloud Broker Infrastructure Cards */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Redis Card */}
              <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-3.5 dark:border-neutral-800 dark:bg-neutral-950/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-rose-500" />
                    <span>Redis 7 (State &amp; Heartbeat)</span>
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    brokerData?.broker?.redis?.connected
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-neutral-500/15 text-neutral-500'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${brokerData?.broker?.redis?.connected ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                    {redisOk ? 'เชื่อมต่อแล้ว' : 'ขาดการเชื่อมต่อ'}
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                  <div className="flex justify-between">
                    <span>Host:</span>
                    <span className="text-neutral-800 dark:text-neutral-200">Cloud Hub • พอร์ต 6379</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Latency:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {redisOk ? `${brokerData.broker.redis.latencyMs} ms` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Nodes:</span>
                    <span className="text-neutral-800 dark:text-neutral-200 font-bold">
                      {brokerNodes.length} ประจำการ
                    </span>
                  </div>
                </div>
              </div>

              {/* Kafka Card */}
              <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-3.5 dark:border-neutral-800 dark:bg-neutral-950/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-indigo-500" />
                    <span>Apache Kafka (Event Stream)</span>
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    brokerData?.broker?.kafka?.connected
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-neutral-500/15 text-neutral-500'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${brokerData?.broker?.kafka?.connected ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                    {kafkaOk ? 'เชื่อมต่อแล้ว' : 'ขาดการเชื่อมต่อ'}
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                  <div className="flex justify-between">
                    <span>Broker:</span>
                    <span className="text-neutral-800 dark:text-neutral-200">Cloud Hub • พอร์ต 9092</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Topics:</span>
                    <span className="text-indigo-600 dark:text-indigo-400">
                      {(brokerData?.broker?.kafka?.topics || []).join(', ') || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mode:</span>
                    <span className="text-neutral-800 dark:text-neutral-200">KRaft (No Zookeeper)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Registered Province Nodes Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-rose-500" />
                  <span>ตำแหน่งประจำการของบอทในแต่ละจังหวัด (ส่งงานหากันผ่านโครงข่ายส่วนกลาง)</span>
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  No Fixed IP Required
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-100/70 text-[11px] text-neutral-500 dark:bg-neutral-800/70 dark:text-neutral-400 font-semibold">
                    <tr>
                      <th className="p-2.5">ชื่อ Bot</th>
                      <th className="p-2.5">จังหวัดที่ประจำการ</th>
                      <th className="p-2.5">ช่องทางสื่อสาร</th>
                      <th className="p-2.5 text-right">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800">
                    {brokerNodes.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-3 text-center text-[11px] text-neutral-500">
                          {redisOk ? 'ยังไม่มีบอทลงทะเบียนในโครงข่าย' : 'ดึงรายชื่อบอทไม่ได้: Redis บน Cloud Hub ขาดการเชื่อมต่อ'}
                        </td>
                      </tr>
                    )}
                    {brokerNodes.map((node: any, idx: number) => (
                      <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                        <td className="p-2.5 font-medium text-neutral-900 dark:text-white flex items-center gap-1.5">
                          <Bot className="h-3.5 w-3.5 text-indigo-500" />
                          <span>{node.botName}</span>
                        </td>
                        <td className="p-2.5 text-neutral-600 dark:text-neutral-300">
                          {node.province || 'กรุงเทพมหานคร'}
                        </td>
                        <td className="p-2.5 font-mono text-[10px] text-neutral-500">
                          Kafka: smlbot.tasks
                        </td>
                        <td className="p-2.5 text-right">
                          <span className={`inline-flex items-center gap-1 font-bold text-[10px] ${node.status === 'busy' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${node.status === 'busy' ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
                            {node.status === 'busy' ? 'กำลังทำงาน' : node.status === 'idle' ? 'ว่าง' : 'ออนไลน์'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-neutral-200/60 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowBrokerModal(false)}
                className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition-colors"
              >
                เข้าใจแล้ว / ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Bot */}
      {showAddBotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
            <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Bot className="h-5 w-5 text-indigo-600" />
              <span>สร้าง Bot ใหม่ (Auto Provision 24/7 VM)</span>
            </h2>

            <form onSubmit={handleCreateBot} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                    ไอคอน
                  </label>
                  <input
                    type="text"
                    value={newBotAvatar}
                    onChange={(e) => setNewBotAvatar(e.target.value)}
                    maxLength={2}
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-2.5 text-center text-xl dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                    ชื่อ Bot *
                  </label>
                  <input
                    type="text"
                    required
                    value={newBotName}
                    onChange={(e) => setNewBotName(e.target.value)}
                    placeholder="เช่น ผู้ช่วยจัดซื้อ, นักวิเคราะห์สต็อก"
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                    บทบาทหน้าที่ *
                  </label>
                  <input
                    type="text"
                    required
                    value={newBotRole}
                    onChange={(e) => setNewBotRole(e.target.value)}
                    placeholder="เช่น วิเคราะห์ราคาสินค้าและคำนวณกำไร"
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                    รูปแบบงาน
                  </label>
                  <select
                    value={newBotWorkMode}
                    onChange={(e) => setNewBotWorkMode(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    <option value="hybrid">🔄 ทั้งเดี่ยวและทีม (Hybrid)</option>
                    <option value="solo">👤 ทำงานเดี่ยว (Solo 24/7)</option>
                    <option value="team">👥 ทำงานเป็นทีม (Team Only)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                    ⚡ สมองกลหลัก (Primary AI)
                  </label>
                  <select
                    value={newBotProviderId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setNewBotProviderId(pid);
                      const p = providers.find((pr) => pr.id === pid);
                      if (p) setNewBotModel(p.defaultModel || p.availableModels[0] || 'default');
                    }}
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name.split(' ')[0]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                    โมเดลหลัก
                  </label>
                  <input
                    type="text"
                    value={newBotModel}
                    onChange={(e) => setNewBotModel(e.target.value)}
                    placeholder="deepseek-chat, glm-5.2-think"
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                    🛡️ สมองกลสำรอง (Backup AI)
                  </label>
                  <select
                    value={newBotFallbackProviderId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setNewBotFallbackProviderId(pid);
                      if (pid) {
                        const p = providers.find((pr) => pr.id === pid);
                        if (p) setNewBotFallbackModel(p.defaultModel || p.availableModels[0] || 'default');
                      } else {
                        setNewBotFallbackModel('');
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    <option value="">(ไม่เปิดใช้สำรอง)</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name.split(' ')[0]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                    โมเดลสำรอง
                  </label>
                  <input
                    type="text"
                    value={newBotFallbackModel}
                    onChange={(e) => setNewBotFallbackModel(e.target.value)}
                    placeholder="deepseek-chat"
                    disabled={!newBotFallbackProviderId}
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-800 font-mono disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl border border-purple-500/20 bg-purple-500/5 dark:border-purple-900/40 dark:bg-purple-950/20">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newBotAutoClone}
                    onChange={(e) => setNewBotAutoClone(e.target.checked)}
                    className="h-4 w-4 rounded accent-purple-600"
                  />
                  <div>
                    <span className="block font-bold text-neutral-800 dark:text-neutral-200">Auto-Clone เมื่อไม่ว่าง</span>
                    <span className="block text-[10px] text-neutral-500 dark:text-neutral-400">สร้าง VM แยกอัตโนมัติ</span>
                  </div>
                </label>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                    จำนวน Clone สูงสุด
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newBotMaxClones}
                    onChange={(e) => setNewBotMaxClones(parseInt(e.target.value, 10) || 1)}
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-800 font-mono text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <label className="flex items-center gap-2 cursor-pointer col-span-2">
                  <input
                    type="checkbox"
                    checked={newBotAutonomousEnabled}
                    onChange={(e) => setNewBotAutonomousEnabled(e.target.checked)}
                    className="h-4 w-4 rounded accent-indigo-600"
                  />
                  <div>
                    <span className="block font-bold text-neutral-800 dark:text-neutral-200">โหมด Autonomous 24/7</span>
                    <span className="block text-[10px] text-neutral-500 dark:text-neutral-400">บอทรันงานเองตามรอบต่อเนื่อง</span>
                  </div>
                </label>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                    รอบงาน (นาที)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={newBotAutonomousInterval}
                    onChange={(e) => setNewBotAutonomousInterval(parseInt(e.target.value, 10) || 15)}
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-800 font-mono text-center"
                  />
                </div>

                <div className="col-span-3">
                  <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                    เป้าหมายภารกิจต่อเนื่อง (Autonomous Goal)
                  </label>
                  <input
                    type="text"
                    value={newBotAutonomousGoal}
                    onChange={(e) => setNewBotAutonomousGoal(e.target.value)}
                    placeholder="เช่น เฝ้าระวังรายการสต็อกและคำนวณจุดสั่งซื้อ"
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                  System Prompt
                </label>
                <textarea
                  rows={3}
                  value={newBotPrompt}
                  onChange={(e) => setNewBotPrompt(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-300 p-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 font-mono leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowAddBotModal(false)}
                  className="rounded-xl border border-neutral-300 px-4 py-2 text-xs font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={creatingBot}
                  className="btn-ripple rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white hover:opacity-95 transition-all shadow-md shadow-indigo-500/25 active:scale-95 disabled:opacity-60 flex items-center gap-1.5"
                >
                  <Server className={`h-3.5 w-3.5 ${creatingBot ? 'animate-spin' : ''}`} />
                  <span>{creatingBot ? 'กำลังสร้าง Bot และ Deploy VM...' : 'สร้าง Bot และรัน VM 24/7 ทันที'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
