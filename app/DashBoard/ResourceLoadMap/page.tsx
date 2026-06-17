'use client';

/**
 * app/DashBoard/ResourceLoadMap/page.tsx
 * ─────────────────────────────────────────
 * Fetches projects + revisions, then renders the ResourceLoadMap heatmap.
 */

import React, { useEffect, useState } from 'react';
import ResourceLoadMap from '../../../components/ResourceLoadMap';
import { Project, Revision } from '../../../types/types';
import { apiClient } from '../../../lib/api';

export default function ResourceLoadMapPage() {
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get('/planning/projects/'),
      apiClient.get('/planning/revisions/'),
    ])
      .then(([pRes, rRes]) => {
        setProjects(pRes.data.results  ?? pRes.data);
        setRevisions(rRes.data.results ?? rRes.data);
      })
      .catch(e => setError(e?.response?.data?.detail ?? 'Failed to load data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="h-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="h-full flex items-center justify-center text-rose-400 text-sm font-mono" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {error}
    </div>
  );

  // pick the latest revision as default
  const latest = [...revisions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];

  return (
    <ResourceLoadMap
      projects={projects}
      revisions={revisions}
      activeRevisionId={latest?.id ?? null}
    />
  );
}
