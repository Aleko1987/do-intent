import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Marketing from './pages/Marketing';
import IntentScorer from './pages/IntentScorer';
import LeadIntent from './pages/LeadIntent';
import Contact from './pages/Contact';
import Pricing from './pages/Pricing';
import CaseStudy from './pages/CaseStudy';

const EXIT_INTENT_DISMISSED_KEY = 'do_intent_exit_intent_dismissed';

function ExitIntentPrompt() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
  }, [location.pathname]);

  useEffect(() => {
    const eligiblePaths = ['/pricing', '/intent-scorer'];
    if (!eligiblePaths.some((path) => location.pathname.startsWith(path))) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    if (sessionStorage.getItem(EXIT_INTENT_DISMISSED_KEY) === '1') {
      return;
    }

    const onMouseOut = (event: MouseEvent) => {
      const toElement = event.relatedTarget as Node | null;
      if (toElement !== null) {
        return;
      }
      if (event.clientY > 8) {
        return;
      }
      setVisible(true);
    };

    document.addEventListener('mouseout', onMouseOut);
    return () => {
      document.removeEventListener('mouseout', onMouseOut);
    };
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: '1rem',
        bottom: '1rem',
        zIndex: 1000,
        background: '#111827',
        color: '#fff',
        borderRadius: '0.75rem',
        padding: '1rem',
        width: 'min(380px, calc(100vw - 2rem))',
        boxShadow: '0 12px 24px rgba(0, 0, 0, 0.28)',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>
        Before you go: get a free intent teardown
      </div>
      <div style={{ fontSize: '0.9rem', opacity: 0.92, marginBottom: '0.75rem' }}>
        We&apos;ll send a mini report with quick wins based on your current traffic intent signals.
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Link
          to="/contact"
          data-intent-cta="true"
          style={{
            background: '#22c55e',
            color: '#052e16',
            textDecoration: 'none',
            borderRadius: '0.5rem',
            padding: '0.45rem 0.75rem',
            fontWeight: 700,
          }}
        >
          Get free report
        </Link>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            sessionStorage.setItem(EXIT_INTENT_DISMISSED_KEY, '1');
          }}
          style={{
            border: '1px solid #4b5563',
            background: 'transparent',
            color: '#e5e7eb',
            borderRadius: '0.5rem',
            padding: '0.45rem 0.75rem',
            cursor: 'pointer',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function AppShell() {
  return (
    <>
      <header style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <Link to="/marketing" style={{ textDecoration: 'none', color: '#111', fontWeight: 700 }}>
            DO-Intent
          </Link>
          <Link to="/pricing" style={{ textDecoration: 'none', color: '#444' }}>
            Pricing
          </Link>
          <Link to="/intent-scorer" style={{ textDecoration: 'none', color: '#444' }}>
            Docs
          </Link>
          <Link
            to="/contact"
            data-intent-cta="true"
            style={{
              textDecoration: 'none',
              background: '#111827',
              color: '#fff',
              borderRadius: '999px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            Get Free Intent Report
          </Link>
        </div>
        <SignedOut>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <SignInButton />
            <SignUpButton />
          </div>
        </SignedOut>
        <SignedIn>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: '#666' }}>You are signed in</span>
            <UserButton />
          </div>
        </SignedIn>
      </header>
      <ExitIntentPrompt />
      <Routes>
        <Route path="/marketing" element={<Marketing />} />
        <Route path="/intent-scorer" element={<IntentScorer />} />
        <Route path="/lead-intent" element={<LeadIntent />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/case-study/:slug" element={<CaseStudy />} />
        <Route path="/" element={<Navigate to="/marketing" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/app">
      <AppShell />
    </BrowserRouter>
  );
}
