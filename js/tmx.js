'use strict';
// TMX (Tiled) level loader (isis_tmx64.py)
// Levels are decoded once (async, because of gzip) and then instantiated synchronously.

const TMX_LAYERS = { TransBG: 'BG_TRANS', BG1: 'BG1', BG2: 'BG2', FG1: 'FG1', FG2: 'FG2', TransFG: 'FG_TRANS', Info: 'INFO', Sprites: 'SPRITES' };

async function inflate(bytes, format) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Returns { width, height, layers: { BG_TRANS: Uint32Array, ... } }
async function parseTMX(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid TMX file');
  const out = { width: 0, height: 0, layers: {} };
  for (const layer of doc.getElementsByTagName('layer')) {
    const key = TMX_LAYERS[layer.getAttribute('name')];
    if (!key) continue;
    const w = parseInt(layer.getAttribute('width'), 10), h = parseInt(layer.getAttribute('height'), 10);
    if (key === 'BG_TRANS') { out.width = w; out.height = h; }
    const data = layer.getElementsByTagName('data')[0];
    const encoding = data.getAttribute('encoding'), compression = data.getAttribute('compression');
    let values;
    if (encoding === 'csv') {
      values = Uint32Array.from(data.textContent.split(',').map((s) => Number(s.trim()) || 0));
    } else if (encoding === 'base64') {
      let bytes = base64ToBytes(data.textContent.trim());
      if (compression === 'gzip') bytes = await inflate(bytes, 'gzip');
      else if (compression === 'zlib') bytes = await inflate(bytes, 'deflate');
      else if (compression) throw new Error('Unsupported TMX compression: ' + compression);
      values = new Uint32Array(bytes.length >> 2);
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      for (let i = 0; i < values.length; i++) values[i] = dv.getUint32(i * 4, true);
    } else {
      throw new Error('Unsupported TMX layer encoding (use base64 or csv)');
    }
    out.layers[key] = values;
  }
  for (const k of Object.values(TMX_LAYERS)) {
    if (!out.layers[k]) throw new Error('TMX file is missing layer for ' + k);
  }
  if (!out.width || !out.height) throw new Error('TMX file has no TransBG layer size');
  return out;
}

// Convert to the [x][y] layout used by the game code
function tmxToLevel(tmx, level) {
  const W = tmx.width, H = tmx.height;
  for (const key of Object.values(TMX_LAYERS)) {
    const src = tmx.layers[key];
    const cols = new Array(W);
    for (let x = 0; x < W; x++) {
      const col = new Uint32Array(H);
      for (let y = 0; y < H; y++) col[y] = src[x + y * W] || 0;
      cols[x] = col;
    }
    level[key] = cols;
  }
  level.width = W;
  level.height = H;
}
