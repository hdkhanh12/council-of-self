'use client'

import { useState, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
import { SessionDetail } from '@/types/debate';

export function useSessionHistory() {
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/sessions');
      if (!res.ok) throw new Error('Không thể tải lịch sử');
      const data: SessionDetail[] = await res.json();
      setSessions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSessionDetail = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    setCurrentSession(null);
    try {
      const res = await fetchWithAuth(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Không thể tải chi tiết phiên');
      const data: SessionDetail = await res.json();
      setCurrentSession(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    sessions,
    currentSession,
    loading,
    error,
    fetchSessions,
    fetchSessionDetail
  };
}
