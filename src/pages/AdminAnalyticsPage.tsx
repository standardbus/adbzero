import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell
} from 'recharts'
import {
    Users, Eye, Clock, MousePointer2, Globe, ArrowUpRight, ArrowDownRight,
    Smartphone, Activity, Flag, AlertTriangle
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/services/supabase'
import { useTranslation } from '@/stores/i18nStore'

// Color palette per i grafici
const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308']

interface AnalyticsStats {
    totalVisitors: number
    totalPageViews: number
    avgDuration: string
    bounceRate: number
    visitorsChange: number
    pageViewsChange: number
    durationChange: number
    bounceChange: number
}

interface ChartData {
    name: string
    value: number
}

interface SessionDetail {
    id: string
    visitor_id: string
    country?: string
    city?: string
    browser: string
    os: string
    device_type: string
    is_demo_mode: boolean
    had_device_connected: boolean
    total_duration: any
    created_at: string
    ip_address?: string
    referrer?: string
    exit_page?: string
    page_views_count: number
    screen_resolution?: string
}

export function AdminAnalyticsPage() {
    const [loading, setLoading] = useState(true)
    const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d' | '1y'>('7d')
    const [stats, setStats] = useState<AnalyticsStats | null>(null)
    const [trafficData, setTrafficData] = useState<ChartData[]>([])
    const [deviceData, setDeviceData] = useState<ChartData[]>([])
    const [resolutionData, setResolutionData] = useState<ChartData[]>([])
    const [exitPageData, setExitPageData] = useState<{ url: string, count: number }[]>([])
    const [recentSessions, setRecentSessions] = useState<SessionDetail[]>([])
    const [topPages, setTopPages] = useState<{ url: string, views: number }[]>([])
    const [topEvents, setTopEvents] = useState<ChartData[]>([])
    const [liveCount, setLiveCount] = useState(0)
    const [liveSessions, setLiveSessions] = useState<SessionDetail[]>([])
    const [debugInfo, setDebugInfo] = useState<Record<string, string>>({})
    const [showDebug, setShowDebug] = useState(false)
    const { t } = useTranslation()

    // Diagnostica completa all'avvio
    useEffect(() => {
        runDiagnostics()
    }, [])

    const runDiagnostics = async () => {
        const info: Record<string, string> = {}

        // 1. Config check
        info['isSupabaseConfigured'] = String(isSupabaseConfigured)

        // 2. Auth check
        const { data: { session } } = await supabase.auth.getSession()
        info['hasSession'] = String(!!session)
        info['userId'] = session?.user?.id || 'NONE'
        info['userEmail'] = session?.user?.email || 'NONE'
        info['appMetadata'] = JSON.stringify(session?.user?.app_metadata || {})

        // 3. is_admin() RPC check
        try {
            const { data: adminCheck, error: adminErr } = await supabase.rpc('is_admin')
            info['is_admin()'] = adminErr ? `ERROR: ${adminErr.message}` : String(adminCheck)
        } catch (e) {
            info['is_admin()'] = `EXCEPTION: ${e}`
        }

        // 4. Direct SELECT on analytics_sessions
        try {
            const { error, count } = await supabase
                .from('analytics_sessions')
                .select('id', { count: 'exact', head: true })
            info['SELECT sessions'] = error ? `ERROR: ${error.message} (code: ${error.code})` : `OK - count: ${count}`
        } catch (e) {
            info['SELECT sessions'] = `EXCEPTION: ${e}`
        }

        // 5. Direct SELECT on analytics_page_views
        try {
            const { error, count } = await supabase
                .from('analytics_page_views')
                .select('id', { count: 'exact', head: true })
            info['SELECT page_views'] = error ? `ERROR: ${error.message} (code: ${error.code})` : `OK - count: ${count}`
        } catch (e) {
            info['SELECT page_views'] = `EXCEPTION: ${e}`
        }

        // 6. Direct SELECT on analytics_events
        try {
            const { error, count } = await supabase
                .from('analytics_events')
                .select('id', { count: 'exact', head: true })
            info['SELECT events'] = error ? `ERROR: ${error.message} (code: ${error.code})` : `OK - count: ${count}`
        } catch (e) {
            info['SELECT events'] = `EXCEPTION: ${e}`
        }

        // 7. Test INSERT (poi cancelliamo)
        const testId = crypto.randomUUID()
        try {
            const { error: insertErr } = await supabase
                .from('analytics_sessions')
                .insert({ id: testId, visitor_id: 'DIAGNOSTIC_TEST', browser: 'test', os: 'test', device_type: 'test', user_agent: 'test' })
            if (insertErr) {
                info['INSERT test'] = `ERROR: ${insertErr.message} (code: ${insertErr.code})`
            } else {
                info['INSERT test'] = 'OK - insert succeeded'
                // Clean up
                await supabase.from('analytics_sessions').delete().eq('id', testId)
            }
        } catch (e) {
            info['INSERT test'] = `EXCEPTION: ${e}`
        }

        // 8. Test RPC track_page_view
        try {
            const { error: rpcErr } = await supabase.rpc('track_page_view', {
                p_session_id: testId,
                p_url: '/diagnostic-test',
                p_title: 'test',
                p_referrer: '',
                p_duration: '0 seconds'
            })
            info['RPC track_page_view'] = rpcErr ? `ERROR: ${rpcErr.message}` : 'OK'
        } catch (e) {
            info['RPC track_page_view'] = `EXCEPTION: ${e}`
        }

        setDebugInfo(info)
    }

    useEffect(() => {
        fetchAnalytics()
    }, [timeRange])

    useEffect(() => {
        const fetchLive = async () => {
            try {
                const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
                const { data, error } = await supabase
                    .from('analytics_sessions')
                    .select('*, analytics_page_views(count)')
                    .gt('last_seen_at', fiveMinsAgo)
                    .order('last_seen_at', { ascending: false })

                if (error) throw error
                setLiveCount(data?.length || 0)
                setLiveSessions(data?.map(s => ({
                    ...s,
                    page_views_count: s.analytics_page_views?.[0]?.count || 0
                })) || [])
            } catch (err) {
                console.error('Live fetch failed:', err)
            }
        }

        fetchLive()
        const interval = setInterval(fetchLive, 10000)

        const channel = supabase
            .channel('live_analytics')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'analytics_sessions'
            }, () => fetchLive())
            .subscribe()

        return () => {
            clearInterval(interval)
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchAnalytics = async () => {
        setLoading(true)
        try {
            // Aspetta che auth sia pronta
            const { data: { session: authSession } } = await supabase.auth.getSession()
            if (!authSession) {
                setDebugInfo(prev => ({ ...prev, 'fetchAnalytics': 'SKIP - no auth session yet' }))
                setLoading(false)
                return
            }

            const now = new Date()
            let startDate = new Date()
            if (timeRange === '24h') startDate.setHours(now.getHours() - 24)
            else if (timeRange === '7d') startDate.setDate(now.getDate() - 7)
            else if (timeRange === '30d') startDate.setDate(now.getDate() - 30)
            else if (timeRange === '90d') startDate.setDate(now.getDate() - 90)
            else if (timeRange === '1y') startDate.setFullYear(now.getFullYear() - 1)

            const startIso = startDate.toISOString()

            // Query sessioni - prima provo senza il JOIN per debug
            const { data: sessions, error: sessionsError } = await supabase
                .from('analytics_sessions')
                .select('*')
                .gte('created_at', startIso)
                .order('created_at', { ascending: false })

            // Log per debug
            setDebugInfo(prev => ({
                ...prev,
                'fetchAnalytics timeRange': timeRange,
                'fetchAnalytics startIso': startIso,
                'fetchAnalytics sessions': sessionsError
                    ? `ERROR: ${sessionsError.message}`
                    : `OK - ${sessions?.length || 0} sessions returned`
            }))

            if (sessionsError) throw sessionsError

            // Ora carica i page_views count per ogni sessione separatamente
            // (evita problemi con il resource embedding)
            if (sessions && sessions.length > 0) {
                const sessionIds = sessions.map(s => s.id)
                const { data: pvCounts } = await supabase
                    .from('analytics_page_views')
                    .select('session_id')
                    .in('session_id', sessionIds)

                // Conta page views per sessione
                const pvCountMap: Record<string, number> = {}
                pvCounts?.forEach(pv => {
                    pvCountMap[pv.session_id] = (pvCountMap[pv.session_id] || 0) + 1
                })

                // Aggiungi il conteggio alle sessioni
                sessions.forEach(s => {
                    (s as any).page_views_count = pvCountMap[s.id] || 0
                })
            }

            const { data: pageViewsData, error: pvError } = await supabase
                .from('analytics_page_views')
                .select('url')
                .gte('timestamp', startIso)

            if (pvError) throw pvError

            const totalVisitors = sessions?.length || 0
            const totalPageViews = pageViewsData?.length || 0
            let totalDurationMs = 0
            let bounceCount = 0

            const browsers: Record<string, number> = {}
            const devices: Record<string, number> = {}
            const oses: Record<string, number> = {}
            const resolutions: Record<string, number> = {}
            const exitPages: Record<string, number> = {}
            const pages: Record<string, number> = {}

            sessions?.forEach(s => {
                if (s.total_duration) {
                    const parts = s.total_duration.split(':')
                    if (parts.length === 3) {
                        totalDurationMs += (parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])) * 1000
                    }
                }

                const pvCount = s.analytics_page_views?.[0]?.count || 0
                if (pvCount <= 1) bounceCount++

                browsers[s.browser || 'Other'] = (browsers[s.browser || 'Other'] || 0) + 1
                devices[s.device_type || 'desktop'] = (devices[s.device_type || 'desktop'] || 0) + 1
                oses[s.os || 'Other'] = (oses[s.os || 'Other'] || 0) + 1
                resolutions[s.screen_resolution || 'Unknown'] = (resolutions[s.screen_resolution || 'Unknown'] || 0) + 1
                if (s.exit_page) {
                    exitPages[s.exit_page] = (exitPages[s.exit_page] || 0) + 1
                }
            })

            pageViewsData?.forEach(pv => {
                pages[pv.url] = (pages[pv.url] || 0) + 1
            })

            setDeviceData(Object.entries(devices).map(([name, value]) => ({ name, value })))
            setResolutionData(Object.entries(resolutions)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 10))
            setExitPageData(Object.entries(exitPages)
                .map(([url, count]) => ({ url, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10))
            setTopPages(Object.entries(pages)
                .map(([url, views]) => ({ url, views }))
                .sort((a, b) => b.views - a.views)
                .slice(0, 10))

            const avgDur = totalVisitors > 0 ? (totalDurationMs / totalVisitors / 1000) : 0
            const minutes = Math.floor(avgDur / 60)
            const seconds = Math.floor(avgDur % 60)

            setStats({
                totalVisitors,
                totalPageViews,
                avgDuration: `${minutes}m ${seconds}s`,
                bounceRate: totalVisitors > 0 ? (bounceCount / totalVisitors) * 100 : 0,
                visitorsChange: 12,
                pageViewsChange: 8,
                durationChange: -5,
                bounceChange: -2
            })

            const traffic: Record<string, number> = {}
            sessions?.forEach(s => {
                const dateObj = new Date(s.created_at)
                let key = dateObj.toLocaleDateString()
                if (timeRange === '24h') {
                    key = `${dateObj.getHours()}:00`
                }
                traffic[key] = (traffic[key] || 0) + 1
            })
            setTrafficData(Object.entries(traffic).map(([name, value]) => ({ name, value })))

            const { data: events, error: eventsError } = await supabase
                .from('analytics_events')
                .select('event_name')
                .gte('timestamp', startIso)

            if (eventsError) throw eventsError

            const eventCounts: Record<string, number> = {}
            events?.forEach(e => {
                eventCounts[e.event_name] = (eventCounts[e.event_name] || 0) + 1
            })
            setTopEvents(Object.entries(eventCounts)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 10))

            setRecentSessions(sessions?.slice(0, 20).map(s => ({
                ...s,
                page_views_count: s.analytics_page_views?.[0]?.count || 0
            })) || [])

        } catch (error: any) {
            console.error('Failed to load analytics:', error)
            setDebugInfo(prev => ({ ...prev, 'fetchAnalytics ERROR': error?.message || String(error) }))
            setShowDebug(true)
        } finally {
            setLoading(false)
        }
    }

    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-accent-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto px-6 py-10 space-y-8 pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
                            {t('analytics.title')}
                        </h1>
                        <p className="text-surface-500 text-sm">
                            {t('analytics.subtitle')}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md shadow-lg shadow-emerald-500/5">
                        <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </div>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
                            {liveCount} {t('analytics.liveOnline')}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-surface-100 dark:bg-white/5 p-1 rounded-xl glass-card">
                    {(['24h', '7d', '30d', '90d', '1y'] as const).map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${timeRange === range
                                ? 'bg-white dark:bg-white/10 text-accent-600 dark:text-accent-400 shadow-sm'
                                : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'
                                }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            {/* Debug Panel */}
            <div className="glass-card overflow-hidden border-amber-500/20">
                <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="w-full p-3 flex items-center justify-between text-left bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
                >
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {t('analytics.diagnostics')} {Object.keys(debugInfo).length > 0 ? `(${Object.keys(debugInfo).length} check)` : `(${t('common.loading')})`}
                    </span>
                    <span className="text-xs text-amber-500">{showDebug ? t('analytics.hide') : t('analytics.show')}</span>
                </button>
                {showDebug && (
                    <div className="p-4 space-y-1 font-mono text-xs">
                        {Object.entries(debugInfo).map(([key, value]) => (
                            <div key={key} className={`flex gap-2 ${value.includes('ERROR') || value.includes('EXCEPTION') || value === 'false' || value === 'NONE' ? 'text-red-500' : 'text-emerald-500'}`}>
                                <span className="text-surface-400 min-w-[180px]">{key}:</span>
                                <span className="break-all">{value}</span>
                            </div>
                        ))}
                        <button
                            onClick={runDiagnostics}
                            className="mt-3 px-3 py-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs hover:bg-amber-500/20"
                        >
                            {t('analytics.reRunDiagnostics')}
                        </button>
                    </div>
                )}
            </div>

            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title={t('analytics.uniqueVisitors')}
                    value={stats?.totalVisitors || 0}
                    change={stats?.visitorsChange || 0}
                    icon={Users}
                    color="accent"
                />
                <StatCard
                    title={t('analytics.pageViews')}
                    value={stats?.totalPageViews || 0}
                    change={stats?.pageViewsChange || 0}
                    icon={Eye}
                    color="blue"
                />
                <StatCard
                    title={t('analytics.avgDuration')}
                    value={stats?.avgDuration || '0m 0s'}
                    change={stats?.durationChange || 0}
                    icon={Clock}
                    color="emerald"
                />
                <StatCard
                    title={t('analytics.bounceRate')}
                    value={`${stats?.bounceRate.toFixed(1)}%`}
                    change={stats?.bounceChange || 0}
                    icon={MousePointer2}
                    color="purple"
                    invert
                />
            </div>

            {/* Live Visitors Section */}
            {liveSessions.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card overflow-hidden border-emerald-500/20"
                >
                    <div className="p-4 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            {t('analytics.activeNow', { count: liveCount })}
                        </h3>
                        <span className="text-[10px] uppercase tracking-wider text-emerald-500/50 font-bold">{t('analytics.realTimeUpdate')}</span>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {liveSessions.map((s) => (
                            <div key={s.id} className="p-4 rounded-2xl bg-surface-50 dark:bg-white/5 border border-surface-200/50 dark:border-white/5 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-accent-500/10 flex items-center justify-center">
                                            <Globe className="w-4 h-4 text-accent-500" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-surface-900 dark:text-white">
                                                {s.country || 'Unknown'}
                                            </span>
                                            <span className="text-[10px] text-surface-500 font-mono">
                                                {s.ip_address || '?.?.?.?'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-medium px-2 py-1 rounded-lg bg-surface-200 dark:bg-white/10 text-surface-600 dark:text-surface-400">
                                        {s.browser}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-[10px] border-t border-surface-200/50 dark:border-white/5 pt-2">
                                    <span className="text-surface-500 flex items-center gap-1 truncate max-w-[150px]">
                                        <Activity className="w-3 h-3" /> {s.exit_page === '/' ? 'Home' : s.exit_page || 'Home'}
                                    </span>
                                    <span className="text-emerald-500 font-bold">{t('analytics.online')}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-card p-6">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-semibold text-lg flex items-center gap-2 text-surface-900 dark:text-white">
                            <Activity className="w-5 h-5 text-accent-500" />
                            {t('analytics.trafficTrend')}
                        </h3>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trafficData}>
                                <defs>
                                    <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'gray' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'gray' }} />
                                <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 23, 23, 0.8)', border: 'none', borderRadius: '12px', color: 'white' }} />
                                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTraffic)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card p-6">
                    <h3 className="font-semibold text-lg mb-8 flex items-center gap-2 text-surface-900 dark:text-white">
                        <Smartphone className="w-5 h-5 text-emerald-500" />
                        {t('analytics.clientBrowser')}
                    </h3>
                    <div className="space-y-6">
                        <div>
                            <p className="text-xs font-bold text-surface-400 uppercase mb-4 tracking-wider">{t('analytics.deviceTypes')}</p>
                            <div className="h-[150px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={deviceData} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                                            {deviceData.map((_, index) => (
                                                <Cell key={`cell-device-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 23, 23, 0.8)', border: 'none', borderRadius: '12px', color: 'white' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-bold text-surface-400 uppercase mb-4 tracking-wider">{t('analytics.topResolutions')}</p>
                            <div className="space-y-2">
                                {resolutionData.slice(0, 3).map((r) => (
                                    <div key={r.name} className="flex items-center justify-between text-[11px]">
                                        <span className="text-surface-500 font-mono truncate max-w-[100px]">{r.name}</span>
                                        <span className="text-surface-400 font-bold">{r.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Second Row Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-card overflow-hidden">
                    <div className="p-6 border-b border-surface-200/50 dark:border-white/5">
                        <h3 className="font-semibold text-lg flex items-center gap-2 text-surface-900 dark:text-white">
                            <Activity className="w-5 h-5 text-blue-500" />
                            {t('analytics.topPages')}
                        </h3>
                    </div>
                    <div className="divide-y divide-surface-200/50 dark:divide-white/5">
                        {topPages.slice(0, 5).map((p) => (
                            <div key={p.url} className="px-6 py-3 flex items-center justify-between hover:bg-surface-50 dark:hover:bg-white/5 transition-colors">
                                <span className="text-xs text-surface-400 font-mono italic truncate max-w-[180px]">
                                    {p.url === '/' ? 'home' : p.url}
                                </span>
                                <span className="text-xs font-bold text-surface-900 dark:text-white">{p.views}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass-card overflow-hidden">
                    <div className="p-6 border-b border-surface-200/50 dark:border-white/5">
                        <h3 className="font-semibold text-lg flex items-center gap-2 text-surface-900 dark:text-white">
                            <Flag className="w-5 h-5 text-red-500" />
                            {t('analytics.exitPages')}
                        </h3>
                    </div>
                    <div className="p-6 space-y-4">
                        {exitPageData.slice(0, 5).map((p) => (
                            <div key={`exit-${p.url}`} className="space-y-1">
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-surface-500 font-mono truncate max-w-[150px]">
                                        {p.url === '/' ? 'home' : p.url}
                                    </span>
                                    <span className="font-bold text-red-500">{p.count}</span>
                                </div>
                                <div className="w-full bg-surface-100 dark:bg-white/5 h-1 rounded-full overflow-hidden">
                                    <div className="bg-red-500 h-full rounded-full" style={{ width: `${(p.count / (exitPageData[0]?.count || 1)) * 100}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass-card p-6">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-surface-900 dark:text-white">
                        <Flag className="w-5 h-5 text-amber-500" />
                        {t('analytics.topEvents')}
                    </h3>
                    <div className="space-y-2">
                        {topEvents.slice(0, 5).map((e) => (
                            <div key={e.name} className="flex items-center justify-between p-2 rounded-lg bg-surface-50 dark:bg-white/5 border border-surface-200/50 dark:border-white/5">
                                <span className="text-[11px] font-medium capitalize truncate max-w-[150px]">
                                    {e.name.replace(/_/g, ' ')}
                                </span>
                                <span className="text-[11px] font-bold text-accent-500">{e.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Sessions Table */}
            <div className="glass-card overflow-hidden">
                <div className="p-6 border-b border-surface-200/50 dark:border-white/5 flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center gap-2 text-surface-900 dark:text-white">
                        <Activity className="w-5 h-5 text-purple-500" />
                        {t('analytics.recentSessions')}
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-xs font-semibold text-surface-400 uppercase tracking-wider border-b border-surface-200/50 dark:border-white/5">
                                <th className="px-6 py-4">{t('analytics.dateIp')}</th>
                                <th className="px-6 py-4 text-center">{t('analytics.origin')}</th>
                                <th className="px-6 py-4 text-center">{t('analytics.pages')}</th>
                                <th className="px-6 py-4 text-center">{t('analytics.resolution')}</th>
                                <th className="px-6 py-4 text-center">{t('analytics.flags')}</th>
                                <th className="px-6 py-4 text-right">{t('analytics.time')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-200/50 dark:divide-white/5">
                            {recentSessions.map((s) => (
                                <tr key={s.id} className="hover:bg-surface-50 dark:hover:bg-white/5 transition-colors group text-sm">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{new Date(s.created_at).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className="text-xs text-surface-500 font-mono">{s.ip_address || '?.?.?.?'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-xs flex items-center justify-center gap-1">
                                            <Globe className="w-3 h-3" /> {s.country || 'Unknown'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center font-medium">{s.page_views_count}</td>
                                    <td className="px-6 py-4 text-center text-xs text-surface-500 font-mono">{s.screen_resolution || '-'}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            {s.is_demo_mode && <div className="w-2 h-2 rounded-full bg-amber-500" title={t('analytics.demoMode')} />}
                                            {s.had_device_connected && <div className="w-2 h-2 rounded-full bg-emerald-500" title={t('analytics.deviceConnected')} />}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-surface-600">{s.total_duration?.split('.')[0] || '0s'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

function StatCard({ title, value, change, icon: Icon, color, invert }: any) {
    const isPositive = change > 0
    const showPositive = invert ? !isPositive : isPositive

    const colorClasses: Record<string, string> = {
        accent: 'text-accent-500 bg-accent-500/10',
        blue: 'text-blue-500 bg-blue-500/10',
        emerald: 'text-emerald-500 bg-emerald-500/10',
        purple: 'text-purple-500 bg-purple-500/10'
    }

    return (
        <motion.div whileHover={{ y: -5 }} className="glass-card p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium ${showPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                    {showPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(change)}%
                </div>
            </div>
            <div>
                <p className="text-sm text-surface-500 font-medium mb-1">{title}</p>
                <p className="text-2xl font-bold tracking-tight">{value}</p>
            </div>
        </motion.div>
    )
}
