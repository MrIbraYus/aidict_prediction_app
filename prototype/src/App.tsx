import { useEffect } from 'react'
import { useRoute } from './lib/router'
import { useApp } from './lib/store'
import { AppShell, useResolvedTheme } from './components/layout/shell'
import { Toaster } from './components/ui/overlay'
import { Card, EmptyState, Button } from './components/ui/primitives'
import { navigate } from './lib/router'
import Dashboard from './pages/Dashboard'
import { Live, Upcoming } from './pages/Matches'
import MatchPage from './pages/match/MatchPage'
import { MultiMatch, SmartPredictions } from './pages/Smart'
import SmartMarkets from './pages/SmartMarkets'
import { HistoryPage, PerformancePage } from './pages/Tracking'
import { CompetitionsPage, PlayerPage, SavedPage, SportsPage, TeamPage } from './pages/Explore'
import { AboutPage, NotificationsPage, ProfilePage, ProvidersPage, ResponsiblePage, SettingsPage } from './pages/Account'
import Login from './pages/Login'
import Admin from './pages/admin/Admin'
import DesignSystem from './pages/DesignSystem'

const TITLES: Record<string, string> = {
  '': 'Dashboard', matches: 'Matches', live: 'Live', match: 'Match analysis', smart: 'Smart Predictions', markets: 'Smart Market Predictions', multi: 'Multi-Match Analysis',
  history: 'Prediction History', performance: 'Performance', sports: 'Sports', competitions: 'Competitions', team: 'Team', player: 'Player',
  saved: 'Saved', notifications: 'Notifications', profile: 'Profile', settings: 'Settings', providers: 'Data Status', responsible: 'Responsible Use',
  about: 'About', admin: 'Admin', design: 'Design System', login: 'Sign in',
}

function Routes() {
  const { parts } = useRoute()
  switch (parts[0] ?? '') {
    case '': return <Dashboard />
    case 'matches': return <Upcoming />
    case 'live': return <Live />
    case 'match': return <MatchPage />
    case 'smart': return <SmartPredictions />
    case 'markets': return <SmartMarkets />
    case 'multi': return <MultiMatch />
    case 'history': return <HistoryPage />
    case 'performance': return <PerformancePage />
    case 'sports': return <SportsPage />
    case 'competitions': return <CompetitionsPage />
    case 'team': return <TeamPage />
    case 'player': return <PlayerPage />
    case 'saved': return <SavedPage />
    case 'notifications': return <NotificationsPage />
    case 'profile': return <ProfilePage />
    case 'settings': return <SettingsPage />
    case 'providers': return <ProvidersPage />
    case 'responsible': return <ResponsiblePage />
    case 'about': return <AboutPage />
    case 'admin': return <Admin />
    case 'design': return <DesignSystem />
    default:
      return (
        <Card>
          <EmptyState title="Page not found" body="This page does not exist." action={<Button onClick={() => navigate('/')}>Go to dashboard</Button>} />
        </Card>
      )
  }
}

export default function App() {
  const { parts, path } = useRoute()
  const theme = useResolvedTheme()
  const viewState = useApp((s) => s.viewState)
  const set = useApp((s) => s.set)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f5f2f1' : '#0f0d0d')
  }, [theme])

  useEffect(() => {
    document.title = `${TITLES[parts[0] ?? ''] ?? 'AIDICT'} · AIDICT prototype`
  }, [parts])

  // Reset forced preview state when navigating so each page opens in its normal state.
  useEffect(() => {
    if (viewState !== 'default') set({ viewState: 'default' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  if (parts[0] === 'login')
    return (
      <>
        <Login />
        <Toaster />
      </>
    )
  return (
    <AppShell>
      <Routes key={parts.slice(0, 2).join('/')} />
    </AppShell>
  )
}
