import { useEffect, useRef, useState } from 'react';

// heartbeat de presença + leitura de configurações públicas (refletem o painel admin)
export function useSettings() {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => alive && setSettings(d))
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return settings;
}

export function useHeartbeat() {
  useEffect(() => {
    const send = () => {
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: window.location.pathname }),
        keepalive: true,
      }).catch(() => {});
    };
    send();
    const timer = setInterval(send, 20000);
    window.addEventListener('beforeunload', send);
    return () => { clearInterval(timer); window.removeEventListener('beforeunload', send); };
  }, []);
}

export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    setState(s => ({ ...s, loading: true, error: null }));
    fnRef.current()
      .then(data => alive && setState({ data, loading: false, error: null }))
      .catch(error => alive && setState({ data: null, loading: false, error: error.message }));
    return () => { alive = false; };
  }, deps);
  return state;
}
