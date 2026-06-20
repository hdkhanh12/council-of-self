'use client'

import { useState, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
import { Turn, VerdictSchema } from '@/types/debate';

export function useDebateStream() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [verdict, setVerdict] = useState<VerdictSchema | null>(null);
  const [status, setStatus] = useState<'idle' | 'streaming' | 'completed' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [nextAction, setNextAction] = useState<string | null>(null);

  const resetDebate = useCallback(() => {
    setTurns([]);
    setVerdict(null);
    setStatus('idle');
    setError(null);
    setCurrentRound(1);
    setSessionId(null);
    setNextAction(null);
  }, []);

  const startDebate = useCallback(async (question: string) => {
    setTurns([]);
    setVerdict(null);
    setStatus('streaming');
    setError(null);
    setCurrentRound(1);
    setSessionId(null);
    setNextAction(null);

    try {
      const response = await fetchWithAuth('/api/debate', {
        method: 'POST',
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        let errMessage = 'Có lỗi xảy ra khi bắt đầu phiên.';
        try {
          const errData = await response.json();
          if (errData.detail) errMessage = errData.detail;
        } catch {}
        throw new Error(errMessage);
      }

      if (!response.body) throw new Error('Không nhận được luồng dữ liệu.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf('\n\n');

        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');

          if (!chunk.trim() || chunk.startsWith(':')) continue;

          let eventName = '';
          let dataStr = '';

          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
              dataStr = line.substring(5).trim();
            }
          }

          if (eventName && dataStr) {
            try {
              const parsedData = JSON.parse(dataStr);
              handleEvent(eventName, parsedData);
            } catch (err) {
              console.error('Failed to parse SSE data:', dataStr, err);
            }
          }
        }
      }
      
      // Once stream is done, if we aren't already completed/error
      setStatus((prev) => (prev === 'streaming' ? 'completed' : prev));

    } catch (err: unknown) {
      console.error('Stream error:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Mất kết nối với máy chủ.');
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEvent = (event: string, data: any) => {
    switch (event) {
      case 'turn':
        setTurns((prev) => [...prev, data as Turn]);
        break;
      case 'round_complete':
        setCurrentRound(data.round);
        if (data.next_action) setNextAction(data.next_action);
        break;
      case 'verdict':
        setVerdict(data as VerdictSchema);
        break;
      case 'error':
        setStatus('error');
        setError(data.message || 'Đã có lỗi từ server.');
        break;
      case 'done':
        setStatus('completed');
        if (data.session_id) setSessionId(data.session_id);
        break;
    }
  };

  return {
    turns,
    verdict,
    status,
    error,
    currentRound,
    sessionId,
    nextAction,
    startDebate,
    resetDebate,
  };
}
