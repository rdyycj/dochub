import React, { useState, Suspense, lazy } from 'react';
import Layout from './components/Layout';

const BrowsePage = lazy(() => import('./pages/BrowsePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const PageLoader: React.FC = () => (
  <div className="flex-1 flex items-center justify-center bg-slate-50">
    <div className="text-slate-400 text-sm">加载中...</div>
  </div>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('browse');
  const [selectedCategory, setSelectedCategory] = useState<number | null | undefined>(undefined);

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab);
        setSelectedCategory(undefined);
      }}
      selectedCategory={selectedCategory}
      onCategorySelect={setSelectedCategory}
    >
      <Suspense fallback={<PageLoader />}>
        {activeTab === 'browse' && (
          <BrowsePage
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
          />
        )}
        {activeTab === 'settings' && <SettingsPage />}
      </Suspense>
    </Layout>
  );
};

export default App;
