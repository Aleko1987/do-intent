import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Marketing from './pages/Marketing';
import IntentScorer from './pages/IntentScorer';
import LeadIntent from './pages/LeadIntent';
import Contact from './pages/Contact';
import Pricing from './pages/Pricing';
import CaseStudy from './pages/CaseStudy';

export default function App() {
  return (
    <>
      <header style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
      <BrowserRouter basename="/app">
        <Routes>
          <Route path="/marketing" element={<Marketing />} />
          <Route path="/intent-scorer" element={<IntentScorer />} />
          <Route path="/lead-intent" element={<LeadIntent />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/case-study/:slug" element={<CaseStudy />} />
          <Route path="/" element={<Navigate to="/marketing" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
