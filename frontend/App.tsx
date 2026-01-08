import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Marketing from './pages/Marketing';
import IntentScorer from './pages/IntentScorer';
import LeadIntent from './pages/LeadIntent';
import Contact from './pages/Contact';
import Pricing from './pages/Pricing';
import CaseStudy from './pages/CaseStudy';

const PUBLISHABLE_KEY = "pk_test_aHVtYmxlLXNlYWwtOTEuY2xlcmsuYWNjb3VudHMuZGV2JA";

function AppInner() {
  return (
    <BrowserRouter>
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
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <AppInner />
    </ClerkProvider>
  );
}
