'use client';
import { useEffect, useRef, useState } from 'react';
import type { SystemEvent, SystemEventType } from '@/types/observatory';

interface UseSSEOptions {
  onEvent?: (event: SystemEvent) => void;
  maxEvents?: number;
}

export function useSSE(url: string, options: UseSSEOptions = {}) {
  const { onEvent, maxEvents = 100 } = options;
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SystemEvent | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      try {
        const event: SystemEvent = JSON.parse(e.data as string);
        setLastEvent(event);
        setEvents((prev) => [event, ...prev].slice(0, maxEvents));
        onEvent?.(event);
      } catch {
        /* malformed event — ignore */
      }
    };

    const ALL_TYPES: SystemEventType[] = [
      'WorkflowStarted',
      'WorkflowFinished',
      'WorkflowFailed',
      'ConnectorConnected',
      'ConnectorDisconnected',
      'AgentOnline',
      'AgentOffline',
      'RetryStarted',
      'RetryFinished',
      'QueueOverflow',
      'QueueRecovered',
      'IncidentOpened',
      'IncidentResolved',
      'AlertTriggered',
      'SLABreached',
      'MetricSampled',
      'HeartBeat',
      'AuditEvent',
    ];

    ALL_TYPES.forEach((type) => {
      es.addEventListener(type, (e) => {
        try {
          const event: SystemEvent = JSON.parse((e as MessageEvent).data as string);
          setLastEvent(event);
          setEvents((prev) => [event, ...prev].slice(0, maxEvents));
          onEvent?.(event);
        } catch {
          /* ignore */
        }
      });
    });

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  return { events, connected, lastEvent };
}
