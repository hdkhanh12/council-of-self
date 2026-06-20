'use client'

import { useEffect, useState } from 'react'
import { fetchWithAuth } from '@/lib/apiClient'
import ProtectedRoute from '@/components/ProtectedRoute'
import { BarChart3, Users, Settings, Activity, ShieldAlert, Clock } from 'lucide-react'

interface OverviewStats {
  total_sessions: number;
  sessions_today: number;
  sessions_in_progress: number;
  sessions_failed: number;
  total_tokens_used_all_time: number;
  total_tokens_used_today: number;
  avg_latency_ms: number;
}

interface UserListItem {
  user_id: string;
  email: string;
  role: string;
  session_count: number;
  created_at: string;
}

interface RuntimeConfig {
  max_rounds: number;
  agent_timeout_s: number;
  max_sessions_per_hour: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [users, setUsers] = useState<UserListItem[]>([])
  const [config, setConfig] = useState<RuntimeConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, usersRes, configRes] = await Promise.all([
          fetchWithAuth('/api/admin/overview'),
          fetchWithAuth('/api/admin/users'),
          fetchWithAuth('/api/admin/config'),
        ])

        if (!statsRes.ok || !usersRes.ok || !configRes.ok) {
          throw new Error('Không thể lấy dữ liệu admin')
        }

        const [s, u, c] = await Promise.all([statsRes.json(), usersRes.json(), configRes.json()])
        setStats(s)
        setUsers(u)
        setConfig(c)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetchWithAuth(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole })
      })
      if (!res.ok) throw new Error('Không thể cập nhật role')
      setUsers(users.map(u => u.user_id === userId ? { ...u, role: newRole } : u))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err))
    }
  }

  if (loading) return <ProtectedRoute requireAdmin><div className="min-h-screen flex items-center justify-center text-white"><div className="animate-pulse">Loading Admin Dashboard...</div></div></ProtectedRoute>
  if (error) return <ProtectedRoute requireAdmin><div className="min-h-screen flex items-center justify-center text-red-400">{error}</div></ProtectedRoute>

  return (
    <ProtectedRoute requireAdmin>
      <main className="min-h-screen py-12 px-4 md:px-8 max-w-[1400px] mx-auto space-y-8">
        <header className="mb-8 flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-amber-500" />
          <h1 className="text-3xl font-bold text-white tracking-wide">Admin Dashboard</h1>
        </header>

        {/* Stats Grid */}
        {stats && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Tổng Phiên" value={stats.total_sessions} icon={<Activity />} sub={`Hôm nay: ${stats.sessions_today}`} color="blue" />
            <StatCard title="Trạng Thái Phiên" value={stats.sessions_in_progress} icon={<Clock />} sub={`${stats.sessions_failed} lỗi`} color="amber" />
            <StatCard title="Tổng Tokens" value={stats.total_tokens_used_all_time.toLocaleString()} icon={<BarChart3 />} sub={`Hôm nay: ${stats.total_tokens_used_today.toLocaleString()}`} color="green" />
            <StatCard title="Độ trễ TB" value={`${stats.avg_latency_ms}ms`} icon={<Activity />} sub="Phản hồi hệ thống" color="rose" />
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User List */}
          <section className="lg:col-span-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Người dùng hệ thống
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-white/5 text-slate-200">
                  <tr>
                    <th className="p-4 rounded-tl-xl">Email</th>
                    <th className="p-4">Phiên</th>
                    <th className="p-4">Ngày tạo</th>
                    <th className="p-4 rounded-tr-xl">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 font-medium text-slate-100">{u.email}</td>
                      <td className="p-4">{u.session_count}</td>
                      <td className="p-4">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="p-4">
                        <select 
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u.user_id, e.target.value)}
                          className="bg-black/40 border border-white/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Config */}
          {config && (
            <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 h-fit">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                Cấu hình Runtime
              </h2>
              <ul className="space-y-4">
                <li className="flex justify-between items-center py-3 border-b border-white/10">
                  <span className="text-slate-300">Số vòng tối đa</span>
                  <span className="font-mono text-white bg-white/10 px-2 py-1 rounded">{config.max_rounds}</span>
                </li>
                <li className="flex justify-between items-center py-3 border-b border-white/10">
                  <span className="text-slate-300">Timeout Agent</span>
                  <span className="font-mono text-white bg-white/10 px-2 py-1 rounded">{config.agent_timeout_s}s</span>
                </li>
                <li className="flex justify-between items-center py-3">
                  <span className="text-slate-300">Rate Limit (/giờ)</span>
                  <span className="font-mono text-white bg-white/10 px-2 py-1 rounded">{config.max_sessions_per_hour}</span>
                </li>
              </ul>
              <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-200">
                Cấu hình này là read-only. Để thay đổi, vui lòng cập nhật biến môi trường Backend.
              </div>
            </section>
          )}
        </div>
      </main>
    </ProtectedRoute>
  )
}

function StatCard({ title, value, icon, sub, color }: { title: string, value: string | number, icon: React.ReactNode, sub: string, color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  }

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-slate-300 font-medium">{title}</h3>
        <div className={`p-2 rounded-xl ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-white mb-2">{value}</div>
      <div className="text-sm text-slate-400">{sub}</div>
    </div>
  )
}
