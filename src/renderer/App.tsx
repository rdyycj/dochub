import React, { useState } from 'react';
import Layout from './components/Layout';
import BrowsePage from './pages/BrowsePage';
import SearchPage from './pages/SearchPage';
import SettingsPage from './pages/SettingsPage';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('browse');

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'browse' && <BrowsePage />}
      {activeTab === 'search' && <SearchPage />}
      {activeTab === 'settings' && <SettingsPage />}
    </Layout>
  );
};

export default App;
