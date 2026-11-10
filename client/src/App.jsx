import { useProgress } from '@react-three/drei'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'

import { platform, setAdScreen, usePlatform } from './bloxity/platform'
import { useGame } from './net/gameStore'
import { renderStats } from './net/liveState'
import { useConnection } from './net/useConnection'
import HUD from './ui/HUD'
import InteractPrompt from './ui/InteractPrompt'
import LoadingScreen from './ui/LoadingScreen'
import MatchUI from './ui/MatchUI'
import Toasts from './ui/Toasts'
import { useTouch } from './ui/touch'
import TouchControls from './ui/TouchControls'

// The 3D scene (three, R3F, the world) is its own chunk so the loading screen paints
// first; the menus aren't needed until the player opens one.
const GameScene = lazy(() => import('./game/GameScene'))
const Modals = lazy(() => import('./ui/Modals'))

/** Bloxity's "Show FPS" setting. */
function FpsReadout() {
  const [fps, setFps] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setFps(renderStats.fps), 500)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="pointer-events-none absolute bottom-2 left-1/2 z-50 -translate-x-1/2 rounded bg-black/50 px-2 py-0.5 font-mono text-xs text-white">
      {fps} FPS
    </div>
  )
}

/** The only menus that show ads: Shop (which also holds the Starter Pack), Items and Quests. */
const AD_PANELS = new Set(['shop', 'items', 'quests'])

/**
 * Ads appear only while one of AD_PANELS is open. Bloxity places screen banners for
 * whichever screen type we announce, so announcing nothing at any other time (lobby,
 * duels, results, other menus) means no banners there.
 */
function useAdScreens() {
  const modal = useGame((s) => s.modal)
  useEffect(() => {
    setAdScreen(AD_PANELS.has(modal) ? 'panel' : null)
  }, [modal])
}

/** Esc closes an open menu; otherwise, inside Bloxity, it opens Bloxity's menu. */
function useEscapeMenu() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || useGame.getState().modal) return
      if (usePlatform.getState().embedded) platform.showMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** Longest we hold the loading screen for the other players' avatars to finish loading. */
const AVATAR_WAIT_MAX_MS = 6000
/** How long three's loaders must stay quiet before we call the avatars loaded. */
const AVATAR_QUIET_MS = 350

/**
 * True once the lobby is really ready to play: the scene is drawn, the game server is
 * connected, and the avatars of the players already there have loaded, so nobody
 * pops in half-built just after the game appears. Without a connection the loading
 * screen stays up (and says so); the avatar wait is capped so a slow download can
 * never keep a player out.
 */
function useLobbyReady(sceneReady) {
  const online = useGame((s) => s.status === 'online')
  const { active } = useProgress()
  const [released, setReleased] = useState(false)

  useEffect(() => {
    if (released || !sceneReady || !online) return undefined
    const id = setTimeout(() => setReleased(true), AVATAR_WAIT_MAX_MS)
    return () => clearTimeout(id)
  }, [released, sceneReady, online])

  useEffect(() => {
    if (released || !sceneReady || !online || active) return undefined
    const id = setTimeout(() => setReleased(true), AVATAR_QUIET_MS)
    return () => clearTimeout(id)
  }, [released, sceneReady, online, active])

  return released
}

function App() {
  useConnection()
  useAdScreens()
  useEscapeMenu()
  const [sceneReady, setSceneReady] = useState(false)
  const ready = useLobbyReady(sceneReady)
  const modal = useGame((s) => s.modal)
  const showFps = usePlatform((s) => s.showFps)
  const touch = useTouch((s) => s.touch)
  const onReady = useCallback(() => setSceneReady(true), [])

  return (
    <div className="relative h-dvh w-screen select-none overflow-hidden bg-[#86c8fb] font-game">
      <Suspense fallback={null}>
        <GameScene onReady={onReady} />
      </Suspense>

      <HUD />
      <MatchUI />
      <InteractPrompt />
      <Toasts />
      {touch && <TouchControls />}
      {showFps && <FpsReadout />}
      {modal && (
        <Suspense fallback={null}>
          <Modals />
        </Suspense>
      )}
      {!ready && <LoadingScreen />}
    </div>
  )
}

export default App
