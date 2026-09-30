import { useState, useMemo, useEffect } from 'react';

export function usePagination<T>(data: T[], itemsPerPage: number = 30) {
  const [currentPage, setCurrentPage] = useState(1);
  const maxPage = Math.max(1, Math.ceil(data.length / itemsPerPage));

  // Reset to first page if data changes significantly or if current page exceeds maxPage
  useEffect(() => {
    if (currentPage > maxPage) {
      setCurrentPage(1);
    }
  }, [data.length, maxPage, currentPage]);

  const currentData = useMemo(() => {
    const begin = (currentPage - 1) * itemsPerPage;
    const end = begin + itemsPerPage;
    return data.slice(begin, end);
  }, [data, currentPage, itemsPerPage]);

  function next() {
    setCurrentPage(currentPage => Math.min(currentPage + 1, maxPage));
  }

  function prev() {
    setCurrentPage(currentPage => Math.max(currentPage - 1, 1));
  }

  function jump(page: number) {
    const pageNumber = Math.max(1, Math.min(page, maxPage));
    setCurrentPage(pageNumber);
  }

  return { next, prev, jump, currentData, currentPage, maxPage, totalItems: data.length };
}
