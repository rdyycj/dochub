import React from 'react';
import StatusBar from './StatusBar';

interface Props {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Layout: React.FC<Props> = ({ children, activeTab, onTabChange }) => {
  const tabs = [
    { id: 'browse', label: '文件浏览' },
    { id: 'search', label: '全文搜索' },
    { id: 'settings', label: '设置' },
  ];

  return (
    <div className="h-screen flex flex-col">
      {/* Top navigation */}
      <div className="flex items-center bg-gray-900 text-white px-4 h-10 gap-1">
        <span className="font-bold text-sm mr-4">DocHub</span>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`px-3 py-1 text-sm rounded ${
              activeTab === tab.id ? 'bg-blue-600' : 'hover:bg-gray-700'
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {children}
      </div>

      {/* Bottom status bar */}
      <StatusBar />
    </div>
  );
};

export default Layout;
