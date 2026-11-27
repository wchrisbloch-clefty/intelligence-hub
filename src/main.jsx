import './styles/tokens.css'
import './styles/primitives.css'
import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AuthGate from './modules/AuthGate.jsx'

// /design — the live token + state reference (Batch Z / A4). URL-only, no nav
// entry. It renders no user data, so it sits outside the AuthGate; that also
// lets the responsive audit screenshot it without an access code.
const DesignPage = lazy(() => import('./modules/design/DesignPage.jsx'))
const isDesign = typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/design'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isDesign
      ? <Suspense fallback={null}><DesignPage /></Suspense>
      : <AuthGate><App /></AuthGate>}
  </StrictMode>,
)
