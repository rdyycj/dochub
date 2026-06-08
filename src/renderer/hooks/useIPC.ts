import { useState, useEffect, useCallback } from 'react';
import { FileInfo, Category, IndexStatus, SearchResult, SearchQuery } from '../../../shared/types';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    window.docHub.listCategories().then(setCategories);
  }, []);

  const refresh = useCallback(() => {
    window.docHub.listCategories().then(setCategories);
  }, []);

  return { categories, refresh };
}

export function useFiles(categoryId?: number | null, page = 1, pageSize = 50) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    window.docHub.listFiles({ categoryId, page, pageSize }).then((res: any) => {
      setFiles(res.files);
      setTotal(res.total);
    });
  }, [categoryId, page, pageSize]);

  return { files, total };
}

export function useStatus() {
  const [status, setStatus] = useState<IndexStatus>({ indexed: 0, pending: 0, error: 0 });

  useEffect(() => {
    const unsubscribe = window.docHub.onStatusUpdate(setStatus);
    return unsubscribe;
  }, []);

  return status;
}

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (query: SearchQuery) => {
    setLoading(true);
    try {
      const res: any = await window.docHub.search(query);
      setResults(res.results);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, total, loading, doSearch };
}
