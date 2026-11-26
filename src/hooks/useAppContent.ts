import { useEffect, useState } from 'react';
import { HAS_API_BASE_URL } from '@/lib/runtime';

interface ContentItem { id: string; slug: string; title: string; body: string; category: string; imageUrl: string | null; updatedAt: string }
// Null means no CMS has been configured yet; [] means intentionally unpublished.
export function useAppContent(kind: 'faq' | 'article') {
  const [items, setItems] = useState<ContentItem[] | null>(null);
  useEffect(() => {
    if (!HAS_API_BASE_URL) return;
    const abort = new AbortController();
    const base = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '').replace(/\/api$/, '');
    fetch(`${base}/api/content/${kind}`, { signal: abort.signal }).then(async response => {
      if (!response.ok) return;
      const body = await response.json();
      if (!abort.signal.aborted && body.configured && Array.isArray(body.data)) setItems(body.data);
    }).catch(() => { /* Keep existing bundled content when CMS is unavailable. */ });
    return () => abort.abort();
  }, [kind]);
  return items;
}
