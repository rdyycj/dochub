import React, { useState } from 'react';
import CategoryTree from '../components/CategoryTree';
import FileList from '../components/FileList';
import SearchBar from '../components/SearchBar';
import { useFiles } from '../hooks/useIPC';

const BrowsePage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<number | null | undefined>(undefined);
  const [page, setPage] = useState(1);
  const { files, total } = useFiles(selectedCategory, page);

  return (
    <div className="flex h-full">
      <CategoryTree selectedId={selectedCategory} onSelect={(id) => { setSelectedCategory(id); setPage(1); }} />
      <div className="flex-1 flex flex-col">
        <SearchBar onSearch={(q) => window.docHub.search({ query: q })} />
        <FileList files={files} total={total} />
      </div>
    </div>
  );
};

export default BrowsePage;
