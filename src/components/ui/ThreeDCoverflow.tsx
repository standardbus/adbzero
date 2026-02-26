import { motion, useAnimationFrame, useMotionValue } from 'framer-motion'
import { Smartphone, Shield, Zap, Monitor, Cpu, Terminal, Layers, Search } from 'lucide-react'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface CoverItem {
    id: number
    titleKey: string
    icon: any
    color: string
    image?: string
}

// LISTA DELLE FUNZIONI: Aggiungi qui l'URL dell'immagine nel campo 'image' per ogni scheda
const ITEMS: CoverItem[] = [
    { id: 1, titleKey: 'nav.debloater', icon: Smartphone, color: 'from-blue-500 to-cyan-500', image: '' },
    { id: 2, titleKey: 'nav.degoogle', icon: Shield, color: 'from-orange-500 to-red-500', image: '' },
    { id: 3, titleKey: 'nav.screenMirror', icon: Monitor, color: 'from-purple-500 to-pink-500', image: '' },
    { id: 4, titleKey: 'nav.privacy', icon: Zap, color: 'from-yellow-500 to-orange-500', image: '' },
    { id: 5, titleKey: 'nav.deviceTools', icon: Cpu, color: 'from-emerald-500 to-teal-500', image: '' },
    { id: 6, titleKey: 'common.appName', icon: Terminal, color: 'from-slate-700 to-slate-900', image: '' },
    { id: 7, titleKey: 'nav.apkInstaller', icon: Layers, color: 'from-indigo-500 to-blue-500', image: '' },
    { id: 8, titleKey: 'common.search', icon: Search, color: 'from-rose-500 to-pink-500', image: '' },
]

export function ThreeDCoverflow() {
    const isMobile = useIsMobile()
    const x = useMotionValue(0)

    // We only need two sets for a seamless loop with transform
    const doubleItems = [...ITEMS, ...ITEMS]
    // Scale down dimensions for mobile
    const itemWidth = isMobile ? 320 : 1040
    const totalWidth = ITEMS.length * itemWidth

    useAnimationFrame((_, delta) => {
        // Stop JS animation on mobile to save CPU/Battery
        if (isMobile) return

        const moveAmount = delta * 0.05 // Speed
        let nextX = x.get() - moveAmount

        // Seamless loop reset
        if (nextX <= -totalWidth) {
            nextX += totalWidth
        }

        x.set(nextX)
    })

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.05] dark:opacity-[0.08] select-none mask-fade-edges flex items-center">
            <motion.div
                style={{ x: isMobile ? 0 : x }}
                animate={isMobile ? { x: [-totalWidth, 0] } : {}}
                transition={isMobile ? {
                    duration: 30,
                    repeat: Infinity,
                    ease: "linear"
                } : {}}
                className={`flex items-center whitespace-nowrap ${isMobile ? 'gap-6' : 'gap-20'}`}
            >
                {doubleItems.map((item, idx) => (
                    <motion.div
                        key={`${item.id}-${idx}`}
                        className={`
                            relative flex-shrink-0 rounded-[2rem] lg:rounded-[4rem]
                            ${!item.image ? `bg-gradient-to-br ${item.color}` : ''}
                            ${isMobile ? 'w-64 h-96 shadow-xl' : 'w-[60rem] h-[45rem] shadow-3xl shadow-black/80'}
                            flex flex-col items-center justify-center p-8 lg:p-16 text-white
                            border-2 border-white/10 ${isMobile ? '' : 'backdrop-blur-md'} overflow-hidden
                        `}
                        style={{
                            perspective: isMobile ? 'none' : '3000px',
                            rotateY: isMobile ? '0deg' : '-30deg',
                            translateZ: '0px',
                        }}
                    >
                        {item.image ? (
                            <img src={item.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                            <item.icon className={`${isMobile ? 'w-24 h-24 mb-6' : 'w-72 h-72 mb-12'} opacity-95 drop-shadow-2xl`} strokeWidth={0.5} />
                        )}

                        <div className="absolute inset-x-0 bottom-6 lg:bottom-10 px-6 text-center z-10">
                            <div className="h-1 w-8 lg:w-12 bg-white/30 mx-auto mb-2 lg:mb-4 rounded-full" />
                            <p className="text-white/60 text-[10px] lg:text-xs font-mono uppercase tracking-widest mb-1">Feature 0{item.id}</p>
                        </div>

                        {/* Gloss effect */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 rounded-[2.5rem]" />
                    </motion.div>
                ))}
            </motion.div>

            <style>{`
                .mask-fade-edges {
                    mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
                    -webkit-mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
                }
            `}</style>
        </div>
    )
}
