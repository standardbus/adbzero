/**
 * Community Debloat Lists Page
 * Reddit-style voting and sharing of debloating configurations
 */

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Users,
    ArrowBigUp,
    ArrowBigDown,
    Search,
    Calendar,
    Package,
    ArrowRight,
    Download,
    Trash2,
    Eye,
    EyeOff,
    Lock,
    MessageSquare,
    Reply,
    Smartphone,
    Check
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/stores/authStore'
import { useTranslation } from '@/stores/i18nStore'
import {
    getCommunityDebloatLists,
    voteDebloatList,
    getDebloatListDetails,
    deleteDebloatList,
    updateDebloatListVisibility,
    getDebloatListComments,
    postDebloatListComment,
    voteDebloatListComment,
    type DebloatList,
    type DebloatListItem,
    type DebloatComment
} from '@/services/supabase'
import { downloadCsv, generatePackagesCsv, type CsvRow } from '@/services/csv-service'
import { useAppStore } from '@/stores/appStore'
import { useAdb } from '@/hooks/useAdb'

// Helper for tree structure
interface CommentNode extends DebloatComment {
    replies: CommentNode[]
}

function buildCommentTree(flatComments: DebloatComment[]): CommentNode[] {
    const map = new Map<string, CommentNode>()
    const roots: CommentNode[] = []

    // Map by ID
    flatComments.forEach(c => {
        map.set(c.id, { ...c, replies: [] })
    })

    // Nest
    flatComments.forEach(c => {
        const node = map.get(c.id)!
        if (c.parent_id && map.has(c.parent_id)) {
            map.get(c.parent_id)!.replies.push(node)
        } else {
            // Root comment or parent deleted
            roots.push(node)
        }
    })

    return roots
}

const CommentItem = ({
    comment,
    onVote,
    onReply,
    isAuthenticated,
    t
}: {
    comment: CommentNode,
    onVote: (id: string, dir: 1 | -1 | 0) => void,
    onReply: (content: string, parentId: string) => void,
    isAuthenticated: boolean,
    t: any
}) => {
    const [isReplying, setIsReplying] = useState(false)
    const [replyContent, setReplyContent] = useState('')

    const handleVote = (dir: 1 | -1) => {
        if (!isAuthenticated) return
        const newVote = comment.user_vote === dir ? 0 : dir
        onVote(comment.id, newVote as 0 | 1 | -1)
    }

    const handleReply = () => {
        if (!replyContent.trim()) return
        onReply(replyContent, comment.id)
        setReplyContent('')
        setIsReplying(false)
    }

    return (
        <div className="flex gap-3 py-4 border-l-2 border-surface-100 dark:border-white/5 pl-4 ml-1">
            {/* Voting Column */}
            <div className="flex flex-col items-center gap-1 mt-1">
                <button
                    onClick={() => handleVote(1)}
                    className={`p-1 rounded hover:bg-surface-100 dark:hover:bg-white/5 transition-colors ${comment.user_vote === 1 ? 'text-accent-500' : 'text-surface-400'}`}
                >
                    <ArrowBigUp className="w-5 h-5" fill={comment.user_vote === 1 ? 'currentColor' : 'none'} />
                </button>
                <span className={`text-xs font-bold ${comment.total_votes > 0 ? 'text-accent-500' : comment.total_votes < 0 ? 'text-red-500' : 'text-surface-500'}`}>
                    {comment.total_votes}
                </span>
                <button
                    onClick={() => handleVote(-1)}
                    className={`p-1 rounded hover:bg-surface-100 dark:hover:bg-white/5 transition-colors ${comment.user_vote === -1 ? 'text-red-500' : 'text-surface-400'}`}
                >
                    <ArrowBigDown className="w-5 h-5" fill={comment.user_vote === -1 ? 'currentColor' : 'none'} />
                </button>
            </div>

            {/* Content Column */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-surface-900 dark:text-[#f0f6fc]">{comment.nickname}</span>
                    <span className="text-xs text-surface-400">
                        {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                </div>
                <p className="text-sm text-surface-700 dark:text-[#c9d1d9] whitespace-pre-wrap leading-relaxed">
                    {comment.content}
                </p>

                {/* Actions */}
                <div className="mt-2 flex items-center gap-4">
                    {isAuthenticated && (
                        <button
                            onClick={() => setIsReplying(!isReplying)}
                            className="text-xs font-medium text-surface-500 hover:text-accent-500 flex items-center gap-1 transition-colors"
                        >
                            <Reply className="w-3.5 h-3.5" />
                            {t('community.reply')}
                        </button>
                    )}
                </div>

                {/* Reply Input */}
                <AnimatePresence>
                    {isReplying && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 space-y-2 overflow-hidden"
                        >
                            <textarea
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder={t('community.writeReply')}
                                className="w-full bg-surface-50 dark:bg-white/5 border border-surface-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 outline-none transition-all resize-none min-h-[80px]"
                            />
                            <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setIsReplying(false)}>
                                    {t('common.cancel')}
                                </Button>
                                <Button size="sm" onClick={handleReply} disabled={!replyContent.trim()}>
                                    {t('community.postComment')}
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Nested Replies */}
                {comment.replies.length > 0 && (
                    <div className="mt-2">
                        {comment.replies.map(reply => (
                            <CommentItem
                                key={reply.id}
                                comment={reply}
                                onVote={onVote}
                                onReply={onReply}
                                isAuthenticated={isAuthenticated}
                                t={t}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

const CommunityListsPage = () => {
    const { user, isAuthenticated } = useAuthStore()
    const { t } = useTranslation()
    const setCurrentPage = useAppStore((state) => state.setCurrentPage)
    const { togglePackage } = useAdb()

    const [lists, setLists] = useState<DebloatList[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedList, setSelectedList] = useState<{ list: DebloatList, items: DebloatListItem[] } | null>(null)
    const [comments, setComments] = useState<DebloatComment[]>([])
    const [loadingComments, setLoadingComments] = useState(false)
    const [newComment, setNewComment] = useState('')
    const [applyingList, setApplyingList] = useState(false)
    const [progress, setProgress] = useState({ current: 0, total: 0, currentPkg: '' })
    const [filterByMyDevice, setFilterByMyDevice] = useState(false)
    const { deviceInfo } = useAdb()

    useEffect(() => {
        loadLists()
    }, [user?.id])

    async function loadLists() {
        setLoading(true)
        try {
            const data = await getCommunityDebloatLists(user?.id)
            setLists(data)
        } catch (error) {
            console.error('Failed to load community lists:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredLists = useMemo(() => {
        let result = lists

        // Filter by device if active
        if (filterByMyDevice && deviceInfo) {
            result = result.filter(l =>
                !l.device_model || // Mostra liste senza info dispositivo
                (l.device_model.toLowerCase() === deviceInfo.model.toLowerCase())
            )
        }

        if (!search) return result
        const s = search.toLowerCase()
        return result.filter(l =>
            l.title.toLowerCase().includes(s) ||
            l.nickname.toLowerCase().includes(s) ||
            l.description?.toLowerCase().includes(s) ||
            l.device_model?.toLowerCase().includes(s)
        )
    }, [lists, search, filterByMyDevice, deviceInfo])

    async function handleVote(listId: string, currentVote: number, targetVote: 1 | -1) {
        if (!isAuthenticated) return

        // New vote logic: if clicking same vote twice, remove it (set to 0)
        const newVote = currentVote === targetVote ? 0 : targetVote

        try {
            await voteDebloatList(user!.id, listId, newVote as 0 | 1 | -1)
            // Update local state to be snappy
            setLists(prev => prev.map(l => {
                if (l.id === listId) {
                    const voteDiff = (newVote as number) - currentVote
                    return { ...l, total_votes: l.total_votes + voteDiff, user_vote: newVote as number }
                }
                return l
            }))
        } catch (error) {
            console.error('Voting failed:', error)
        }
    }

    async function viewListDetails(list: DebloatList) {
        try {
            const details = await getDebloatListDetails(list.id)
            setSelectedList(details)
            loadComments(list.id)
        } catch (error) {
            console.error('Failed to load list details:', error)
        }
    }

    async function loadComments(listId: string) {
        setLoadingComments(true)
        try {
            const data = await getDebloatListComments(listId, user?.id)
            setComments(data)
        } catch (error) {
            console.error('Failed to load comments:', error)
        } finally {
            setLoadingComments(false)
        }
    }

    async function handlePostComment(content: string, parentId: string | null = null) {
        if (!user || !selectedList) return

        try {
            await postDebloatListComment(
                selectedList.list.id,
                user.id,
                user.user_metadata?.nickname || user.email?.split('@')[0] || 'Anonymous',
                content,
                parentId
            )
            loadComments(selectedList.list.id)
            if (!parentId) setNewComment('')
        } catch (error) {
            console.error('Failed to post comment:', error)
        }
    }

    async function handleVoteComment(commentId: string, vote: 1 | -1 | 0) {
        if (!user) return

        try {
            await voteDebloatListComment(user.id, commentId, vote as 1 | -1 | 0)
            // Local update for snappiness
            setComments(prev => prev.map(c => {
                if (c.id === commentId) {
                    const diff = (vote as number) - (c.user_vote || 0)
                    return { ...c, total_votes: c.total_votes + diff, user_vote: vote as number }
                }
                return c
            }))
        } catch (error) {
            console.error('Failed to vote comment:', error)
        }
    }

    async function applyDebloatList() {
        if (!selectedList) return

        setApplyingList(true)
        const items = selectedList.items
        setProgress({ current: 0, total: items.length, currentPkg: '' })

        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            setProgress(p => ({ ...p, current: i + 1, currentPkg: item.package_name }))

            try {
                // Disabilita il pacchetto sul dispositivo
                await togglePackage(item.package_name, false)
            } catch (error) {
                console.warn(`Failed to disable ${item.package_name}:`, error)
            }
        }

        setApplyingList(false)
        setSelectedList(null)
    }

    async function handleDeleteList(listId: string) {
        if (!user || !window.confirm(t('common.confirmAction'))) return

        try {
            await deleteDebloatList(user.id, listId)
            setLists(prev => prev.filter(l => l.id !== listId))
            if (selectedList?.list.id === listId) setSelectedList(null)
        } catch (error) {
            console.error('Failed to delete list:', error)
        }
    }

    async function handleToggleVisibility(list: DebloatList) {
        if (!user) return

        const newVisibility = !list.is_public
        try {
            await updateDebloatListVisibility(user.id, list.id, newVisibility)
            setLists(prev => prev.map(l => l.id === list.id ? { ...l, is_public: newVisibility } : l))
            if (selectedList?.list.id === list.id) {
                setSelectedList({ ...selectedList, list: { ...selectedList.list, is_public: newVisibility } })
            }
        } catch (error) {
            console.error('Failed to update visibility:', error)
        }
    }

    function handleDownloadCSV(list: DebloatList, items: DebloatListItem[]) {
        const rows: CsvRow[] = items.map(item => ({
            packageId: item.package_name,
            name: item.label || '',
            description: item.description || '',
            level: item.level || 'Recommended'
        }))

        const csvContent = generatePackagesCsv(
            list.nickname,
            rows,
            list.device_model ? { manufacturer: list.device_manufacturer || '', model: list.device_model } : undefined
        )
        downloadCsv(`${list.title.replace(/\s+/g, '_')}_debloat.csv`, csvContent)
    }

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-surface-900 dark:text-white flex items-center gap-3">
                        <Users className="w-8 h-8 text-accent-500" />
                        {t('community.title')}
                    </h1>
                    <p className="text-surface-500 dark:text-[#8b949e] mt-1">
                        {t('community.subtitle')}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="secondary"
                        onClick={() => setCurrentPage('debloater')}
                        className="rounded-xl"
                    >
                        {t('community.createList')}
                    </Button>
                </div>
            </div>

            {/* Search and Filters */}
            <Card className="p-4 bg-white/50 dark:bg-[#161b22]/50 backdrop-blur-xl border-surface-200 dark:border-[#30363d]">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                        <SearchInput
                            placeholder={t('community.searchPlaceholder')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-12 bg-white dark:bg-[#0d1117] rounded-xl"
                        />
                    </div>
                    {deviceInfo && (
                        <Button
                            variant={filterByMyDevice ? 'primary' : 'secondary'}
                            onClick={() => setFilterByMyDevice(!filterByMyDevice)}
                            className="rounded-xl h-12 gap-2 whitespace-nowrap"
                        >
                            <Smartphone className="w-5 h-5" />
                            {filterByMyDevice ? t('community.showingMyDevice') : t('community.filterByDevice')}
                            {filterByMyDevice && <Check className="w-4 h-4" />}
                        </Button>
                    )}
                </div>
            </Card>

            {/* Lists Grid */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-10 h-10 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : filteredLists.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLists.map((list) => (
                        <motion.div
                            key={list.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -4 }}
                            className="group"
                        >
                            <Card className="h-full flex flex-col p-5 bg-white dark:bg-[#161b22] hover:border-accent-500/50 transition-all shadow-sm hover:shadow-xl dark:shadow-none border-surface-200 dark:border-[#30363d] rounded-2xl overflow-hidden relative">
                                <div className="flex gap-4">
                                    {/* Voting column */}
                                    <div className="flex flex-col items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => handleVote(list.id, list.user_vote || 0, 1)}
                                            className={`p-1.5 rounded-lg transition-colors ${list.user_vote === 1
                                                ? 'text-orange-500 bg-orange-500/10'
                                                : 'text-surface-400 hover:text-orange-500 hover:bg-surface-100 dark:hover:bg-white/5'
                                                }`}
                                        >
                                            <ArrowBigUp className={`w-6 h-6 ${list.user_vote === 1 ? 'fill-current' : ''}`} />
                                        </button>
                                        <span className={`font-bold text-sm ${list.user_vote === 1 ? 'text-orange-500' :
                                            list.user_vote === -1 ? 'text-blue-500' : 'text-surface-600 dark:text-[#c9d1d9]'
                                            }`}>
                                            {list.total_votes}
                                        </span>
                                        <button
                                            onClick={() => handleVote(list.id, list.user_vote || 0, -1)}
                                            className={`p-1.5 rounded-lg transition-colors ${list.user_vote === -1
                                                ? 'text-blue-500 bg-blue-500/10'
                                                : 'text-surface-400 hover:text-blue-500 hover:bg-surface-100 dark:hover:bg-white/5'
                                                }`}
                                        >
                                            <ArrowBigDown className={`w-6 h-6 ${list.user_vote === -1 ? 'fill-current' : ''}`} />
                                        </button>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 truncate">
                                                <h3 className="text-lg font-bold text-surface-900 dark:text-[#f0f6fc] truncate group-hover:text-accent-500 transition-colors">
                                                    {list.title}
                                                </h3>
                                                {!list.is_public && (
                                                    <Lock className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                                                )}
                                            </div>
                                        </div>

                                        <p className="text-sm text-surface-500 dark:text-[#8b949e] mt-1 line-clamp-2 min-h-[2.5rem]">
                                            {list.description || 'No description provided.'}
                                        </p>

                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs text-surface-400">
                                            <span className="flex items-center gap-1 font-medium text-surface-600 dark:text-[#c9d1d9]">
                                                <Users className="w-3.5 h-3.5" />
                                                {list.nickname}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Package className="w-3.5 h-3.5" />
                                                {list.items_count} {t('community.apps')}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {new Date(list.created_at).toLocaleDateString()}
                                            </span>
                                            {list.device_model && (
                                                <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md ${deviceInfo?.model === list.device_model ? 'bg-accent-500/10 text-accent-500' : ''}`}>
                                                    <Smartphone className="w-3.5 h-3.5" />
                                                    {list.device_model}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-6 flex items-center justify-between">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => viewListDetails(list)}
                                                className="rounded-xl text-accent-500 hover:text-accent-600 hover:bg-accent-500/5 group/btn px-2"
                                            >
                                                {t('community.exploreList')}
                                                <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover/btn:translate-x-1" />
                                            </Button>

                                            <div className="flex items-center gap-1">
                                                {user?.id === list.user_id && (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleToggleVisibility(list) }}
                                                            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/5 text-surface-400 hover:text-accent-500 transition-colors"
                                                            title={list.is_public ? t('community.makePrivate') : t('community.makePublic')}
                                                        >
                                                            {list.is_public ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id) }}
                                                            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/5 text-surface-400 hover:text-red-500 transition-colors"
                                                            title={t('community.deleteList')}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-surface-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <Search className="w-10 h-10 text-surface-300" />
                    </div>
                    <h3 className="text-xl font-bold text-surface-900 dark:text-white">{t('community.noLists')}</h3>
                    <p className="text-surface-500 dark:text-[#8b949e] mt-2">
                        {t('community.beFirst')}
                    </p>
                </div>
            )}

            {/* Details Modal */}
            <AnimatePresence>
                {selectedList && (
                    <Modal
                        isOpen={!!selectedList}
                        onClose={() => setSelectedList(null)}
                        title={selectedList.list.title}
                        size="lg"
                    >
                        <div className="space-y-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm text-surface-500 dark:text-[#8b949e]">
                                        {t('community.by')} <span className="font-bold text-surface-700 dark:text-[#c9d1d9]">{selectedList.list.nickname}</span> •
                                        {t('community.created')} {new Date(selectedList.list.created_at).toLocaleDateString()}
                                    </p>
                                    {selectedList.list.description && (
                                        <p className="mt-3 text-surface-700 dark:text-[#c9d1d9] leading-relaxed italic border-l-4 border-accent-500/20 pl-4">
                                            "{selectedList.list.description}"
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="rounded-xl gap-2"
                                        onClick={() => handleDownloadCSV(selectedList.list, selectedList.items)}
                                    >
                                        <Download className="w-4 h-4" /> CSV
                                    </Button>
                                    {user?.id === selectedList.list.user_id && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="rounded-xl p-2"
                                            onClick={() => handleToggleVisibility(selectedList.list)}
                                            title={selectedList.list.is_public ? t('community.makePrivate') : t('community.makePublic')}
                                        >
                                            {selectedList.list.is_public ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="border border-surface-200 dark:border-[#30363d] rounded-2xl overflow-hidden bg-surface-50 dark:bg-[#0d1117]">
                                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="bg-surface-100 dark:bg-[#161b22] sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold text-surface-600 dark:text-[#8b949e] border-b dark:border-[#30363d]">App</th>
                                                <th className="px-4 py-3 font-semibold text-surface-600 dark:text-[#8b949e] border-b dark:border-[#30363d]">Package</th>
                                                <th className="px-4 py-3 font-semibold text-surface-600 dark:text-[#8b949e] border-b dark:border-[#30363d]">Level</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-200 dark:divide-[#30363d]">
                                            {selectedList.items.map((item) => (
                                                <tr key={item.id} className="hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-surface-900 dark:text-[#f0f6fc]">{item.label || t('community.unknown')}</td>
                                                    <td className="px-4 py-3 text-xs font-mono text-surface-500 dark:text-[#8b949e]">{item.package_name}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${item.level === 'Recommended' ? 'bg-emerald-500/10 text-emerald-500' :
                                                            item.level === 'Advanced' ? 'bg-blue-500/10 text-blue-500' :
                                                                item.level === 'Expert' ? 'bg-orange-500/10 text-orange-500' :
                                                                    'bg-red-500/10 text-red-500'
                                                            }`}>
                                                            {item.level}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t dark:border-[#30363d]">
                                <Button
                                    variant="ghost"
                                    onClick={() => setSelectedList(null)}
                                    className="rounded-xl px-6"
                                >
                                    {t('community.close')}
                                </Button>
                                <Button
                                    onClick={applyDebloatList}
                                    disabled={applyingList}
                                    className="rounded-xl px-8 bg-accent-500 hover:bg-accent-600 text-white font-bold shadow-lg shadow-accent-500/20"
                                >
                                    {applyingList ? (
                                        <span className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            {t('community.applying')}
                                        </span>
                                    ) : (
                                        t('community.applyToDevice')
                                    )}
                                </Button>
                            </div>

                            <hr className="border-surface-100 dark:border-white/5" />

                            {/* Comments Section */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-accent-500" />
                                    <h4 className="text-lg font-bold text-surface-900 dark:text-white">
                                        {t('community.comments')}
                                    </h4>
                                </div>

                                {isAuthenticated ? (
                                    <div className="space-y-3">
                                        <textarea
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            placeholder={t('community.writeComment')}
                                            className="w-full bg-surface-50 dark:bg-white/5 border border-surface-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 outline-none transition-all resize-none min-h-[100px]"
                                        />
                                        <div className="flex justify-end">
                                            <Button
                                                onClick={() => handlePostComment(newComment)}
                                                disabled={!newComment.trim()}
                                            >
                                                {t('community.postComment')}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <Card className="p-6 border-dashed border-2 flex flex-col items-center justify-center text-center">
                                        <Lock className="w-8 h-8 text-surface-300 mb-2" />
                                        <p className="text-sm text-surface-500">{t('community.loginToComment')}</p>
                                    </Card>
                                )}

                                {loadingComments ? (
                                    <div className="flex justify-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500"></div>
                                    </div>
                                ) : comments.length > 0 ? (
                                    <div className="divide-y divide-surface-100 dark:divide-white/5">
                                        {buildCommentTree(comments).map(comment => (
                                            <CommentItem
                                                key={comment.id}
                                                comment={comment}
                                                onVote={handleVoteComment}
                                                onReply={handlePostComment}
                                                isAuthenticated={isAuthenticated}
                                                t={t}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-surface-500">
                                        {t('community.noComments')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Applying Progress Modal */}
            <AnimatePresence>
                {applyingList && (
                    <Modal
                        isOpen={true}
                        onClose={() => { }} // No close during critical action
                        title={t('community.disablingPackages')}
                        showCloseButton={false}
                    >
                        <div className="py-6 space-y-6">
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="relative w-24 h-24 flex items-center justify-center mb-6">
                                    <div className="absolute inset-0 border-4 border-accent-500/10 rounded-full" />
                                    <motion.div
                                        className="absolute inset-0 border-4 border-accent-500 border-t-transparent rounded-full"
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    />
                                    <Package className="w-10 h-10 text-accent-500 animate-pulse" />
                                </div>

                                <h3 className="text-xl font-bold text-surface-900 dark:text-[#f0f6fc]">
                                    {t('community.disablingPackages')}
                                </h3>
                                <p className="text-sm text-surface-500 dark:text-[#8b949e] mt-1 max-w-xs">
                                    {t('community.keepConnected', { count: progress.total })}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-semibold mb-1">
                                    <span className="text-surface-400">{t('community.progress')}</span>
                                    <span className="text-accent-500">{Math.round((progress.current / progress.total) * 100)}%</span>
                                </div>
                                <div className="w-full h-3 bg-surface-100 dark:bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-accent-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    />
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-surface-400 font-mono truncate h-4">
                                    <ArrowRight className="w-3 h-3 text-accent-500 shrink-0" />
                                    {progress.currentPkg}
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    )
}

export { CommunityListsPage }
