import React from 'react';
import { useStatus } from '../hooks/useIPC';

const StatusBar: React.FC = () => {
  const status = useStatus();

  return (
    <div className="h-8 bg-gray-800 text-gray-300 flex items-center px-4 text-sm gap-4 border-t border-gray-700">
      <span>✅ 已索引 {status.indexed.toLocaleString()}</span>
      <span>⏳ 待处理 {status.pending.toLocaleString()}</span>
      {status.error > 0 && <span className="text-red-400">❌ 出错 {status.error.toLocaleString()}</span>}
    </div>
  );
};

export default StatusBar;
