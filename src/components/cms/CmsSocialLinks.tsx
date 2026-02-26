import { TWITTER_URL, BLUESKY_URL, REDDIT_URL } from '@/config/app'

const SOCIAL_ITEMS = [
    { id: 'twitter', url: TWITTER_URL, icon: '/twitter-x-icon.svg', color: 'hover:bg-[#1DA1F2] hover:text-white' },
    { id: 'bluesky', url: BLUESKY_URL, icon: '/bluesky-icon.svg', color: 'hover:bg-[#0560ff] hover:text-white' },
    { id: 'reddit', url: REDDIT_URL, icon: '/reddit-icon.svg', color: 'hover:bg-[#FF4500] hover:text-white' },
].filter(item => item.url && item.url.trim() !== '')

export function CmsSocialLinks() {
    if (SOCIAL_ITEMS.length === 0) return null

    return (
        <div className="flex items-center gap-3">
            {SOCIAL_ITEMS.map((item) => (
                <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-10 h-10 rounded-xl bg-surface-100 dark:bg-white/5 flex items-center justify-center text-surface-600 dark:text-surface-400 transition-all ${item.color}`}
                    title={item.id.charAt(0).toUpperCase() + item.id.slice(1)}
                >
                    <img src={item.icon} alt={item.id} className="w-5 h-5 object-contain" />
                </a>
            ))}
        </div>
    )
}
