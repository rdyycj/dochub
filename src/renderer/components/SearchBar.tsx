import React, { useState } from 'react';

interface Props {
  onSearch: (query: string) => void;
  onClear?: () => void;
  placeholder?: string;
}

const SearchBar: React.FC<Props> = ({ onSearch, onClear, placeholder = '搜索…' }) => {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (q) {
      onSearch(q);
    }
  };

  const handleClear = () => {
    setValue('');
    onClear?.();
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-200">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-3 py-1.5 border border-slate-200 rounded text-sm focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:border-transparent focus:outline-none"
      />
      <button
        type="submit"
        className="px-3 py-1.5 bg-slate-600 text-white text-sm rounded hover:bg-slate-700 transition-colors"
      >
        搜索
      </button>
      {value && (
        <button
          type="button"
          className="px-3 py-1.5 text-slate-400 text-sm hover:text-slate-600 transition-colors"
          onClick={handleClear}
        >
          ✕
        </button>
      )}
    </form>
  );
};

export default SearchBar;
