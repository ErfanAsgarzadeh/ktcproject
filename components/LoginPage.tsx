'use client';

import React, { useState, useEffect } from 'react';
import { CustomUser } from '../types/types'; // مسیر را در صورت نیاز اصلاح کنید
import { apiClient } from '../lib/api'; // ایمپورت کلاینت API
import {
  KeyRound, Mail, User, Briefcase, CodeSquare, Sparkles, ArrowRight,
  Eye, EyeOff, CheckCircle, AlertCircle, Clock, ShieldCheck, Moon, Sun, Users
} from 'lucide-react';

interface LoginPageProps {
  users: CustomUser[]; // (اختیاری) اگر هنوز می‌خواهید لیست Roster را نمایش دهید
  onLoginSuccess: (user: CustomUser) => void;
  // onRegisterUser دیگر نیازی نیست به عنوان Prop پاس داده شود چون مستقیم به API متصل شدیم
  isLightMode: boolean;
  onToggleTheme: () => void;
}

export default function LoginPage({
                                    users,
                                    onLoginSuccess,
                                    isLightMode,
                                    onToggleTheme
                                  }: LoginPageProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loginMethod, setLoginMethod] = useState<'credentials' | 'roster'>('credentials');

  // Credentials States
  const [username, setUsername] = useState(''); // به جای email از username استفاده می‌کنیم تا با جنگو مچ شود
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register States
  const [regName, setRegName] = useState(''); // در جنگو به عنوان username استفاده می‌شود
  const [regJob, setRegJob] = useState('');
  const [regCode, setRegCode] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  const [regError, setRegError] = useState('');

  // Forgot password flow
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Real-time time display
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Autofill برای حالت دمو (Roster)
  const handleAutofill = (user: CustomUser) => {
    setUsername(user.username);
    setPassword('nexus123'); // فرض بر این است که اکانت‌های دمو در دیتابیس با این رمز ساخته شده‌اند
    setLoginMethod('credentials');
  };

  // ----- تابع اتصال ورود به سرور -----
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!username.trim() || !password.trim()) {
      setLoginError('لطفاً نام کاربری و رمز عبور خود را وارد کنید.');
      return;
    }

    setLoginLoading(true);

    try {
      // 1. دریافت توکن از جنگو
      const tokenResponse = await apiClient.post('/token/', {
        username: username.trim(),
        password: password
      });

      // ذخیره توکن در لوکال استوریج (apiClient از این به بعد از این توکن استفاده می‌کند)
      localStorage.setItem('access_token', tokenResponse.data.access);
      localStorage.setItem('refresh_token', tokenResponse.data.refresh);

      // 2. دریافت اطلاعات کامل پروفایل برای آپدیت State سیستم
      const profileResponse = await apiClient.get('/auth/profile/');

      onLoginSuccess(profileResponse.data);

    } catch (error: any) {
      console.error("Login failed:", error);
      setLoginError(
          error.response?.data?.detail ||
          'اطلاعات ورود نامعتبر است. لطفاً نام کاربری و رمز عبور را بررسی کنید.'
      );
    } finally {
      setLoginLoading(false);
    }
  };

  // ----- تابع اتصال ثبت‌نام به سرور -----
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (!regName.trim() || !regJob.trim() || !regCode.trim() || !regPassword.trim()) {
      setRegError('لطفاً تمام فیلدها را پر کنید.');
      return;
    }

    setRegLoading(true);
    try {
      // ارسال اطلاعات به سریالایزر جنگو
      await apiClient.post('/auth/register/', {
        username: regName.trim(),
        jobTitle: regJob.trim(),
        employeeCode: regCode.trim(),
        password: regPassword
      });

      setRegSuccess(true);

      // انتقال خودکار به فرم ورود پس از ثبت‌نام موفق
      setTimeout(() => {
        setRegSuccess(false);
        setTab('login');
        setUsername(regName.trim());
        setPassword(regPassword);
        setLoginMethod('credentials');
      }, 1500);

    } catch (error: any) {
      console.error("Registration failed:", error.response?.data);
      // نمایش ارورهای دریافتی از سریالایزر جنگو (مثل تکراری بودن نام کاربری)
      const errorMsg = error.response?.data?.username?.[0] || 'خطایی در ثبت‌نام رخ داد. نام کاربری یا کد پرسنلی ممکن است تکراری باشد.';
      setRegError(errorMsg);
    } finally {
      setRegLoading(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSent(true);
    setTimeout(() => {
      setShowForgotModal(false);
      setForgotSent(false);
      setForgotEmail('');
    }, 2800);
  };

  return (
      <div className="h-screen w-full bg-[#0a0f1d] text-slate-200 flex flex-col justify-between font-sans relative overflow-hidden">
        {/* Background radial glowing ambient lights */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none z-0" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-600/10 blur-[150px] rounded-full pointer-events-none z-0" />
        {isLightMode && (
            <div className="absolute top-[20%] left-[30%] w-[400px] h-[400px] bg-sky-200/50 blur-[100px] rounded-full pointer-events-none z-0" />
        )}

        {/* Top Notification Status Bar */}
        <header className="z-10 w-full px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/5 bg-slate-950/20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 rounded-xl border border-white/10 shadow-lg flex items-center justify-center">
              <CodeSquare className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-cyan-400 font-mono">Operations Portal v3.7</span>
              <h1 className="text-base font-extrabold text-white tracking-tight">Nexus Workspace CPM</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs font-mono text-slate-300">
              <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>{utcTime || 'SYS_CALIBRATING...'}</span>
            </div>

            <button
                type="button"
                onClick={onToggleTheme}
                className="p-2 bg-black/30 hover:bg-white/5 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer shadow-md"
            >
              {isLightMode ? <Moon className="w-4 h-4 text-cyan-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>
          </div>
        </header>

        {/* Main Form Center Layout */}
        <main className="flex-1 flex items-center justify-center p-6 z-10 my-auto">
          <div className="w-full max-w-4xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[500px]">

            {/* LEFT COLUMN: Features & Branding Information */}
            <div className="md:w-[42%] bg-gradient-to-tr from-cyan-950/50 via-slate-900/60 to-indigo-950/50 p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/10 relative">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent pointer-events-none" />

              <div className="space-y-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-[10px] font-bold uppercase tracking-wider font-mono">
                  <ShieldCheck className="w-3 h-3" /> SECURE DEPLOYMENT
                </div>

                <div className="space-y-3">
                  <h2 className="text-2xl font-black text-white tracking-tight leading-tight">
                    Next-Gen Critical Path Scheduler.
                  </h2>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Real-time network diagram engine, automated baseline tracking, multi-user project allocations, and collaborative task logs unified on a high-fidelity visual slate.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="bg-black/20 border border-white/5 p-3.5 rounded-xl">
                    <span className="text-xs text-slate-500 block uppercase font-mono font-bold tracking-wide">ALGORITHMS</span>
                    <span className="text-lg font-extrabold text-cyan-400 font-mono">F9 CPM PASSED</span>
                  </div>
                  <div className="bg-black/20 border border-white/5 p-3.5 rounded-xl">
                    <span className="text-xs text-slate-500 block uppercase font-mono font-bold tracking-wide">DATABASES</span>
                    <span className="text-lg font-extrabold text-indigo-400 font-mono">SQL-DJANGO READY</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Interactive Form Interface */}
            <div className="flex-1 p-8 sm:p-10 flex flex-col justify-center">
              <div className="flex items-center gap-1 bg-black/40 p-1 border border-white/5 rounded-2xl mb-8 self-start">
                <button
                    type="button"
                    onClick={() => setTab('login')}
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                        tab === 'login'
                            ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                            : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  Sign In
                </button>
                <button
                    type="button"
                    onClick={() => setTab('register')}
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                        tab === 'register'
                            ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                            : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  Join Team Roster
                </button>
              </div>

              {tab === 'login' ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 border-b border-white/5 pb-4 mb-2">
                      <button
                          type="button"
                          onClick={() => setLoginMethod('credentials')}
                          className={`text-xs font-bold font-mono uppercase tracking-wider transition-all pb-1.5 border-b-2 ${
                              loginMethod === 'credentials'
                                  ? 'border-cyan-500 text-cyan-400'
                                  : 'border-transparent text-slate-500 hover:text-slate-300'
                          }`}
                      >
                        Credentials
                      </button>
                      <button
                          type="button"
                          onClick={() => setLoginMethod('roster')}
                          className={`text-xs font-bold font-mono uppercase tracking-wider transition-all pb-1.5 border-b-2 ${
                              loginMethod === 'roster'
                                  ? 'border-cyan-500 text-cyan-400'
                                  : 'border-transparent text-slate-500 hover:text-slate-300'
                          }`}
                      >
                        Quick-Access ({users.length})
                      </button>
                    </div>

                    {loginMethod === 'credentials' ? (
                        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                          <h3 className="text-lg font-bold text-white tracking-tight mb-4">Enter Operations Portal Credentials</h3>

                          {loginError && (
                              <div className="flex items-center gap-2 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs font-medium animate-shake">
                                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                <span>{loginError}</span>
                              </div>
                          )}

                          <div className="space-y-1">
                            <label className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400">Username</label>
                            <div className="relative">
                              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                              <input
                                  type="text"
                                  value={username}
                                  onChange={e => setUsername(e.target.value)}
                                  placeholder="نام کاربری خود را وارد کنید"
                                  className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 shadow-inner"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400">Portal Security Password</label>
                            </div>
                            <div className="relative">
                              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                              <input
                                  type={showPassword ? 'text' : 'password'}
                                  value={password}
                                  onChange={e => setPassword(e.target.value)}
                                  placeholder="••••••••"
                                  className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 shadow-inner"
                              />
                              <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          <button
                              type="submit"
                              disabled={loginLoading}
                              className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3.5 px-5 rounded-xl transition-all shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2 mt-4 cursor-pointer active:scale-95 duration-100"
                          >
                            {loginLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                  <span>Authorise Portal Session</span>
                                  <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                          </button>
                        </form>
                    ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1">
                            {users.map(u => (
                                <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => handleAutofill(u)}
                                    className="bg-black/20 hover:bg-cyan-500/5 hover:border-cyan-500/30 border border-white/5 hover:shadow-cyan-500/5 hover:shadow-lg p-3.5 rounded-2xl text-left transition-all flex items-start gap-3 group"
                                >
                                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 border border-white/10 flex items-center justify-center text-xs font-black text-cyan-400 group-hover:scale-105 transition-transform">
                                    {u.username.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-bold text-slate-200 truncate group-hover:text-cyan-300 transition-colors">
                                      {u.username}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{u.jobTitle}</p>
                                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">{u.employeeCode}</p>
                                  </div>
                                </button>
                            ))}
                          </div>
                        </div>
                    )}
                  </div>
              ) : (
                  <form onSubmit={handleRegisterSubmit} className="space-y-1">
                    <h3 className="text-lg font-bold text-white tracking-tight mb-2">Register Project Member Account</h3>

                    {regSuccess && (
                        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs font-medium">
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>User Registered Successfully! Redirecting to login...</span>
                        </div>
                    )}

                    {regError && (
                        <div className="flex items-center gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs font-medium">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>{regError}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400">Username</label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                              type="text"
                              required
                              value={regName}
                              onChange={e => setRegName(e.target.value)}
                              placeholder="نام کاربری (انگلیسی)"
                              className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 shadow-inner"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400">Job Title</label>
                        <div className="relative">
                          <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                              type="text"
                              required
                              value={regJob}
                              onChange={e => setRegJob(e.target.value)}
                              placeholder="عنوان شغلی"
                              className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 shadow-inner"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400">Employee Code</label>
                        <input
                            type="text"
                            required
                            value={regCode}
                            onChange={e => setRegCode(e.target.value)}
                            placeholder="e.g. EMP-120"
                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 shadow-inner font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400">System Password</label>
                        <input
                            type="password"
                            required
                            placeholder="••••••••"
                            value={regPassword}
                            onChange={e => setRegPassword(e.target.value)}
                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 shadow-inner"
                        />
                      </div>
                    </div>

                    <button
                        type="submit"
                        disabled={regLoading}
                        className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 px-5 rounded-xl transition-all shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2 mt-4 cursor-pointer"
                    >
                      {regLoading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                          <>
                            <span>Join System Roster & Generate Credentials</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                      )}
                    </button>
                  </form>
              )}
            </div>
          </div>
        </main>
      </div>
  );
}