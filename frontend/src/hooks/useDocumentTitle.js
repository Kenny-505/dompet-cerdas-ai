import { useEffect } from 'react';

/**
 * Custom hook for setting document title
 * @param {string} title - The page-specific title (will be appended to base title)
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    const baseTitle = 'DompetCerdas AI';
    document.title = title ? `${title} | ${baseTitle}` : baseTitle;
    
    // Cleanup: reset to base title on unmount
    return () => {
      document.title = baseTitle;
    };
  }, [title]);
}

export default useDocumentTitle;