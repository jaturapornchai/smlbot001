'use client';

import React, { useState, useEffect } from 'react';
import { BotGroup, BotProperty, BotMessage } from '@/types/bot';
import { Users, Plus, Send, Bot, CheckCircle, ShieldAlert, Sparkles } from 'lucide-react';

export default function GroupsPage() {
  const [groups, setGroups] = useState<BotGroup[]>([]);
  const [bots, setBots] = useState<BotProperty[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // New Group Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('🏢');
  const [newLeaderId, setNewLeaderId] = useState('');
  const [newMemberIds, setNewMemberIds] = useState<string[]>([]);
  const [newCollabMode, setNewCollabMode] = useState<'sequential' | 'brainstorm' | 'mention_only'>('sequential');

  const fetchData = async () => {
    try {
      const [gRes, bRes] = await Promise.all([
        fetch('/api/groups'),
        fetch('/api/bots'),
      ]);
      const gData = await gRes.json();
      const bData = await bRes.json();
      if (gData.success) {
        setGroups(gData.data);
        if (gData.data.length > 0 && !selectedGroupId) {
          setSelectedGroupId(gData.data[0].id);
        }
      }
      if (bData.success) {
        setBots(bData.data);
        if (bData.data.length > 0 && !newLeaderId) {
          setNewLeaderId(bData.data[0].id);
          setNewMemberIds([bData.data[0].id]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const sendGroupMessage = async (text: string) => {
    if (!text.trim() || !selectedGroupId || sending) return;

    const userMsg: BotMessage = {
      id: `user-${Date.now()}`,
      groupId: selectedGroupId,
      botId: 'user',
      senderName: 'ลุงจืด',
      avatar: '👨‍💼',
      sender: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    const currentInput = text;
    setInputMessage('');
    setSending(true);

    try {
      const res = await fetch(`/api/groups/${selectedGroupId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setMessages((prev) => [...prev, ...data.data]);
      } else {
        alert(`ส่งข้อความไม่สำเร็จ: ${data.error || res.status}`);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    sendGroupMessage(inputMessage);
  };

  // อนุมัติ Draft: เดิมเป็น alert() เฉย ๆ → ตอนนี้บันทึกสถานะอนุมัติ และส่งคำอนุมัติให้ทีมดำเนินการต่อจริง
  const handleApproveDraft = (msg: BotMessage) => {
    if (!msg.draftAction || msg.draftAction.approved) return;
    const title = msg.draftAction.title;
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id && m.draftAction ? { ...m, draftAction: { ...m.draftAction, approved: true } } : m))
    );
    sendGroupMessage(`✅ อนุมัติแล้ว: ${title} — ดำเนินการต่อได้เลย`);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newLeaderId) return;

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName,
          description: newGroupDesc,
          icon: newGroupIcon,
          leaderBotId: newLeaderId,
          memberBotIds: newMemberIds,
          collaborationMode: newCollabMode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setNewGroupName('');
        setNewGroupDesc('');
        fetchData();
      } else {
        alert(`สร้างกลุ่มไม่สำเร็จ: ${data.error || res.status}`);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            ทีมทำงานร่วม (Multi-Bot Team Rooms)
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            จับกลุ่มบอทหลายตัวเข้ามาทำงานร่วมกัน สื่อสารข้าม VM ผ่านระบบคิวงานอัตโนมัติ
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>สร้างกลุ่มใหม่</span>
        </button>
      </div>

      {/* Main Container: Left Group List + Right Chat Room */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Group List */}
        <div className="space-y-3 lg:col-span-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            ห้องกลุ่มทั้งหมด ({groups.length})
          </h2>

          <div className="space-y-2">
            {groups.map((group) => {
              const isSelected = group.id === selectedGroupId;
              const leader = bots.find((b) => b.id === group.leaderBotId);

              return (
                <button
                  key={group.id}
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    setMessages([]);
                  }}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-xs dark:border-indigo-500 dark:bg-indigo-950/20'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-xl shadow-xs dark:bg-neutral-800">
                      {group.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-sm text-neutral-900 dark:text-white">
                        {group.name}
                      </h3>
                      <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                        หัวหน้า: {leader ? leader.name : 'ยังไม่ระบุ'} • สมาชิก {group.memberBotIds.length} ตัว
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Group Chat / Collaboration Feed */}
        <div className="flex flex-col h-[650px] rounded-xl border border-neutral-200 bg-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900 lg:col-span-2">
          {/* Chat Header */}
          {selectedGroup && (
            <div className="flex items-center justify-between border-b border-neutral-100 p-4 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedGroup.icon}</span>
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-white">
                    {selectedGroup.name}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    โหมด: {selectedGroup.collaborationMode === 'sequential' ? 'ลำดับขั้น (A → B → C)' : 'ระดมสมอง (Brainstorm)'}
                  </p>
                </div>
              </div>

              {/* Members Avatars */}
              <div className="flex items-center -space-x-2">
                {selectedGroup.memberBotIds.map((mId) => {
                  const b = bots.find((bot) => bot.id === mId);
                  return (
                    <span
                      key={mId}
                      title={b?.name || mId}
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-neutral-100 text-xs shadow-xs dark:border-neutral-900 dark:bg-neutral-800"
                    >
                      {b?.avatar || '🤖'}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chat Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-neutral-400 text-xs space-y-2">
                <Users className="h-8 w-8 text-neutral-300 dark:text-neutral-700" />
                <p>ห้องประชุมทีมพร้อมแล้ว</p>
                <p className="text-neutral-500">
                  พิมพ์คำสั่งหรือมอบหมายโจทย์ด้านล่าง เพื่อให้บอทในกลุ่มร่วมมือกันทำงาน
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender !== 'user' && (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-base dark:bg-neutral-800">
                      {msg.avatar}
                    </span>
                  )}

                  <div className={`max-w-[80%] space-y-1`}>
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                        {msg.senderName}
                      </span>
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div
                      className={`rounded-xl p-3 text-sm leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                      }`}
                    >
                      {msg.content}
                    </div>

                    {/* Draft Action Card (Human in the loop) */}
                    {msg.draftAction && (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900/50 dark:bg-amber-950/30 space-y-2">
                        <div className="flex items-center justify-between text-amber-900 dark:text-amber-300 font-semibold">
                          <span>⚡ {msg.draftAction.title}</span>
                          <span className="rounded bg-amber-200/60 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            {msg.draftAction.approved ? 'อนุมัติแล้ว' : 'รออนุมัติ'}
                          </span>
                        </div>
                        <p className="text-amber-800 dark:text-amber-200/80">
                          {msg.draftAction.details}
                        </p>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => handleApproveDraft(msg)}
                            disabled={msg.draftAction.approved || sending}
                            className="btn-ripple inline-flex items-center gap-1 rounded bg-amber-600 px-3 py-1 font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>อนุมัติ Action นี้</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {msg.sender === 'user' && (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-base dark:bg-indigo-900">
                      {msg.avatar}
                    </span>
                  )}
                </div>
              ))
            )}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-neutral-400 italic">
                <Sparkles className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                <span>บอทในทีมกำลังวิเคราะห์และคุยกัน...</span>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2 border-t border-neutral-100 p-3 dark:border-neutral-800"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="พิมพ์คำสั่งมอบหมายงานให้ทีมบอท..."
              className="flex-1 rounded-lg border border-neutral-200 px-3.5 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
            <button
              type="submit"
              disabled={sending || !inputMessage.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              <Send className="h-4 w-4" />
              <span>ส่งงาน</span>
            </button>
          </form>
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              สร้างกลุ่มทีมบอทใหม่
            </h2>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    ไอคอน
                  </label>
                  <input
                    type="text"
                    value={newGroupIcon}
                    onChange={(e) => setNewGroupIcon(e.target.value)}
                    maxLength={2}
                    className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-center text-lg dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    ชื่อกลุ่มทีม *
                  </label>
                  <input
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="เช่น ทีมตรวจสอบบัญชีและภาษี"
                    className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  หัวหน้าทีมผู้ประสานงาน (Team Leader)
                </label>
                <select
                  value={newLeaderId}
                  onChange={(e) => setNewLeaderId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                >
                  {bots.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.avatar} {b.name} ({b.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  เลือกสมาชิกบอทเข้าร่วมทีม
                </label>
                <div className="mt-2 max-h-40 overflow-y-auto space-y-1.5 rounded-lg border border-neutral-200 p-2 text-xs dark:border-neutral-700">
                  {bots.map((b) => {
                    const checked = newMemberIds.includes(b.id);
                    return (
                      <label key={b.id} className="flex items-center gap-2 p-1 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewMemberIds((prev) => [...prev, b.id]);
                            } else {
                              setNewMemberIds((prev) => prev.filter((id) => id !== b.id));
                            }
                          }}
                          className="h-4 w-4 rounded accent-indigo-600"
                        />
                        <span>{b.avatar} {b.name}</span>
                        <span className="text-neutral-400">({b.role})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
                >
                  บันทึกกลุ่ม
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
