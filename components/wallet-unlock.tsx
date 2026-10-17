"use client";

import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { Camera, ClipboardPaste, Type, X } from 'lucide-react';
import { restoreWalletPrivateKey } from '@/lib/hive-wallet';

function Hex({ dashed = false }: { dashed?: boolean }) {
  return <svg className="unlock-hex-outline" viewBox="0 0 208 218" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0b0e09" stroke="currentColor" strokeWidth="2" strokeDasharray={dashed ? '24 11' : undefined} /></svg>;
}

export default function WalletUnlock({ busy, onUnlock }: { busy: boolean; onUnlock: (key: string) => Promise<void> }) {
  const [mode, setMode] = useState<'paste' | 'text' | 'camera'>('paste');
  const [text, setText] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const capture = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const locked = useRef(false);
  const disabled = busy || working;

  function stopCamera() {
    generation.current++;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }
  useEffect(() => () => { stopCamera(); }, []);

  async function unlock(value: string) {
    restoreWalletPrivateKey(value);
    stopCamera();
    setMode('paste');
    setText('');
    setMessage('Private key recognized. Opening your wallet…');
    await onUnlock(value);
  }

  async function perform(task: () => Promise<void>) {
    if (locked.current || busy) return;
    locked.current = true;
    setWorking(true);
    try { await task(); }
    catch { setMessage('Could not open that key. Use your wallet private-key QR or text, not the public key or payment QR.'); }
    finally { locked.current = false; setWorking(false); }
  }

  async function readImage(file: Blob) {
    const { walletKeyFromImage } = await import('@/lib/read-wallet-qr');
    await unlock(await walletKeyFromImage(file));
  }

  async function paste() {
    stopCamera();
    setMode('paste');
    setMessage('');
    let items: ClipboardItems | undefined;
    try {
      if (navigator.clipboard?.read) items = await navigator.clipboard.read();
    } catch { /* The user can use the local photo picker when clipboard access is blocked. */ }
    if (items) {
      for (const item of items) {
        const type = item.types.find(type => type.startsWith('image/'));
        if (type) { await readImage(await item.getType(type)); return; }
      }
      for (const item of items) {
        if (item.types.includes('text/plain')) {
          await unlock(await (await item.getType('text/plain')).text());
          return;
        }
      }
    }
    let copied = '';
    try { copied = await navigator.clipboard?.readText() ?? ''; } catch { /* Show picker fallback. */ }
    if (copied.trim()) { await unlock(copied); return; }
    setMessage('Clipboard unavailable or empty. Choose your saved screenshot below, or use Text.');
  }

  function pasted(event: ClipboardEvent) {
    const file = Array.from(event.clipboardData.files).find(file => file.type.startsWith('image/'));
    if (file) { event.preventDefault(); void perform(() => readImage(file)); }
    else if (mode !== 'text') {
      const value = event.clipboardData.getData('text/plain');
      if (value) { event.preventDefault(); void perform(() => unlock(value)); }
    }
  }

  async function startCamera() {
    stopCamera();
    setMode('camera');
    setMessage('Allow camera access, then point it at your private-key QR.');
    const request = generation.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (request !== generation.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      if (!video.current) { stopCamera(); return; }
      video.current.srcObject = media;
      await video.current.play();
      const { walletKeyFromPixels } = await import('@/lib/read-wallet-qr');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const scan = () => {
        if (request !== generation.current || !context) return;
        const frame = video.current;
        if (frame?.videoWidth && !locked.current && !busy) {
          const scale = Math.min(1, 1000 / frame.videoWidth);
          canvas.width = Math.round(frame.videoWidth * scale);
          canvas.height = Math.round(frame.videoHeight * scale);
          context.drawImage(frame, 0, 0, canvas.width, canvas.height);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          try {
            const key = walletKeyFromPixels(pixels.data, pixels.width, pixels.height);
            context.clearRect(0, 0, canvas.width, canvas.height);
            if (key) { void perform(() => unlock(key)); return; }
          } catch { setMessage('That QR is not a wallet private key. Point at your private-key QR.'); }
        }
        window.setTimeout(scan, 300);
      };
      scan();
    } catch {
      if (request !== generation.current) return;
      stopCamera();
      setMode('paste');
      setMessage('Camera access is unavailable here. Choose a screenshot, or take a photo below.');
    }
  }

  return <section className="wallet-unlock" onPaste={pasted} aria-label="Restore your Bitcoin wallet">
    <h2>Enter The Hive</h2>
    <p className="unlock-intro">Paste your private key to open your wallet.</p>
    <div className="unlock-honeycomb">
      <div className="unlock-main-hex"><Hex dashed />
        <button className="unlock-paste" disabled={disabled} onClick={() => void perform(paste)} aria-label="Paste private-key screenshot or text"><ClipboardPaste aria-hidden="true" /><strong>{disabled ? 'Opening…' : 'Paste'}</strong><span>Private key or screenshot</span></button>
      </div>
      <button className="unlock-side-hex unlock-camera" aria-label="Scan private key with camera" disabled={disabled} onClick={() => void startCamera()}><Hex /><span><Camera aria-hidden="true" /><small>Camera</small></span></button>
      <button className="unlock-side-hex unlock-text" aria-label="Enter private key as text" aria-expanded={mode === 'text'} disabled={disabled} onClick={() => { stopCamera(); setMode(mode === 'text' ? 'paste' : 'text'); setMessage(''); }}><Hex /><span><Type aria-hidden="true" /><small>Text</small></span></button>
    </div>
    <input ref={upload} type="file" accept="image/*" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) { stopCamera(); setMode('paste'); void perform(() => readImage(file)); } }} />
    <input ref={capture} type="file" accept="image/*" capture="environment" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void perform(() => readImage(file)); }} />
    <button className="unlock-photo-link" disabled={disabled} onClick={() => upload.current?.click()}>Choose a saved screenshot</button>
    {mode === 'text' && <form className="unlock-text-panel" onSubmit={event => { event.preventDefault(); void perform(() => unlock(text)); }}>
      <label htmlFor="wallet-private-key">Private key or recovery words</label>
      <textarea id="wallet-private-key" autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} value={text} onChange={event => setText(event.target.value)} placeholder="hive-wallet-v1:…" />
      <button disabled={disabled || !text.trim()} type="submit">Open my wallet →</button>
    </form>}
    {mode === 'camera' && <div className="unlock-camera-panel"><video ref={video} autoPlay muted playsInline aria-label="Private-key QR camera preview" /><button onClick={() => { stopCamera(); setMode('paste'); }} aria-label="Close camera"><X size={18} />Close camera</button></div>}
    {message && <p className="unlock-feedback" role="status">{message}</p>}
    {message.startsWith('Camera access') && <button className="unlock-photo-link" onClick={() => capture.current?.click()}>Take a photo</button>}
    <p className="unlock-privacy">Your screenshot is read on this device.</p>
  </section>;
}
