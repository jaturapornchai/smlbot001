'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Users, Cpu, LayoutDashboard, Plus, Server, Sparkles } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'ภาพรวมระบบ', icon: LayoutDashboard },
    { href: '/bots', label: 'จัดการ Bot (24/7)', icon: Bot },
    { href: '/groups', label: 'ทีมทำงานร่วม (Team)', icon: Users },
    { href: '/providers', label: 'สมองกล AI', icon: Cpu },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-200/80 bg-white/75 backdrop-blur-xl transition-colors dark:border-neutral-800/80 dark:bg-neutral-950/75">
      <div className="mx-auto flex h-15 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo with Ambient Glow */}
        <div className="flex items-center gap-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 text-white font-bold shadow-md shadow-indigo-500/25 transition-transform duration-300 group-hover:scale-105">
              <span className="text-sm font-black tracking-tight">S</span>
              <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 opacity-0 blur-xs transition-opacity duration-300 group-hover:opacity-60" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black tracking-tight bg-gradient-to-r from-neutral-900 to-neutral-700 bg-clip-text text-transparent dark:from-white dark:to-neutral-300">
                SML Bot
              </span>
              <span className="text-[10px] font-mono tracking-widest text-indigo-600 dark:text-indigo-400 font-bold -mt-1 uppercase">
                Enterprise 24/7
              </span>
            </div>
          </Link>

          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-indigo-200/60 bg-indigo-50/50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 backdrop-blur-xs dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">
            <Sparkles className="h-3 w-3 text-indigo-500" />
            <span>Agent Zero Core</span>
          </span>
        </div>

        {/* Navigation Links with Active Indicator */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-xs dark:bg-white dark:text-neutral-950'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-400 dark:text-indigo-600' : ''}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Actions: Server Status, Theme Toggle & New Bot */}
        <div className="flex items-center gap-2.5">
          {/* Host Indicator */}
          <div className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-neutral-200/70 bg-neutral-100/60 px-3 py-1.5 text-xs text-neutral-600 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-semibold">เซิร์ฟเวอร์หลัก (24/7 Core)</span>
          </div>

          {/* Theme Toggle (Dark / Light) */}
          <ThemeToggle />

          {/* New Bot Button with Glow */}
          <Link
            href="/bots/new"
            className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-indigo-500/35 active:scale-95"
          >
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <Plus className="h-3.5 w-3.5" />
            <span>สร้าง Bot</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
