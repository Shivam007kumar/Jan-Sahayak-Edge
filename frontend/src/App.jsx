import { useState } from 'react';
import VaultPanel from './components/VaultPanel';
import ChatPanel from './components/ChatPanel';
import LandingPage from './components/LandingPage';
import SchemesFeed from './components/SchemesFeed';

export default function App() {
  const [isVerified, setIsVerified] = useState(false);

  if (!isVerified) {
    return (
      <div className="h-screen w-full flex bg-[#F8FAFC] text-gray-900 overflow-hidden font-[family-name:var(--font-sans)]">
        <LandingPage onVerify={() => setIsVerified(true)} />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex bg-[#F8FAFC] text-gray-900 overflow-hidden font-[family-name:var(--font-sans)]">
      <VaultPanel />
      <SchemesFeed />
      <ChatPanel />
    </div>
  );
}
