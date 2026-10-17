import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import { createWalletAccessKeys, restoreWalletPrivateKey } from '../lib/hive-wallet.ts';

// Load the browser helper in Node without changing the app's module resolution.
const source = readFileSync(new URL('../lib/read-wallet-qr.ts', import.meta.url), 'utf8')
  .replace("'jsqr'", JSON.stringify(import.meta.resolve('jsqr')))
  .replace("'./hive-wallet'", JSON.stringify(new URL('../lib/hive-wallet.ts', import.meta.url).href));
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { walletKeyFromPixels } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const words = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const keys = createWalletAccessKeys(words);

// Rasterize the same QR renderer used by the private-key screen, inside a
// portrait screenshot with space around it. No real wallet secrets are used.
function screenshot(value) {
  const svg = renderToStaticMarkup(React.createElement(QRCodeSVG, { value, marginSize: 4, size: 240 }));
  const modules = Number(svg.match(/viewBox="0 0 (\d+)/)[1]);
  const scale = 6, qrSize = modules * scale, width = 430, height = 820;
  const x0 = Math.floor((width - qrSize) / 2), y0 = 260;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) { pixels[i] = 8; pixels[i+1] = 10; pixels[i+2] = 7; pixels[i+3] = 255; }
  const fill = (x,y,w,h,v) => { for (let row=y;row<y+h;row++) for(let col=x;col<x+w;col++){ const i=(row*width+col)*4;pixels[i]=pixels[i+1]=pixels[i+2]=v; } };
  fill(x0,y0,qrSize,qrSize,255);
  const path = svg.match(/fill="#000000" d="([^"]+)"/)[1];
  for (const match of path.matchAll(/M(\d+)[ ,]+(\d+)\s*h(\d+)v1H\d+z/g)) {
    fill(x0+Number(match[1])*scale,y0+Number(match[2])*scale,Number(match[3])*scale,scale,0);
  }
  return { pixels, width, height };
}

test('a private-key screenshot decodes back to the exact wallet', () => {
  const {pixels,width,height} = screenshot(keys.privateKey);
  const decoded = walletKeyFromPixels(pixels,width,height);
  assert.equal(decoded,keys.privateKey);
  assert.equal(restoreWalletPrivateKey(decoded),words);
});
test('public-key screenshots cannot unlock a wallet', () => {
  const {pixels,width,height} = screenshot(keys.publicKey);
  assert.throws(() => walletKeyFromPixels(pixels,width,height));
});
test('an image with no QR is not accepted', () => {
  assert.equal(walletKeyFromPixels(new Uint8ClampedArray(100*100*4).fill(255),100,100),null);
});
