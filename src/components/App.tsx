import { useState } from 'react';
import { DetailView } from './DetailView';
import { BatchView } from './BatchView';

type Tab = 'detail' | 'batch';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('detail');

  return (
    <div>
      <header className="app-header">
        <div>
          <div className="app-title">NX AUDIO ANALYZER</div>
          <div className="app-subtitle">Powered by NEXTLIGHT</div>
        </div>
        <a href="https://nextlight.io" target="_blank" rel="noopener noreferrer" className="header-link">
          公式サイト
        </a>
      </header>

      <nav className="tab-bar">
        <button
          className={`tab-item ${activeTab === 'detail' ? 'active' : ''}`}
          onClick={() => setActiveTab('detail')}
        >
          詳細分析
        </button>
        <button
          className={`tab-item ${activeTab === 'batch' ? 'active' : ''}`}
          onClick={() => setActiveTab('batch')}
        >
          バッチ比較
        </button>
      </nav>

      {activeTab === 'detail' && <DetailView />}
      {activeTab === 'batch' && <BatchView />}
    </div>
  );
}
