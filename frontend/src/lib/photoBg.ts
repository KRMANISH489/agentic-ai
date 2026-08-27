export const BG_SWATCHES = ["#ffffff", "#f1f1f1", "#dacebe", "#db8f2a", "#1a1612", "#0f766e", "#1d4ed8", "#be123c"];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, iw: number, ih: number, w: number, h: number) {
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function drawContain(ctx: CanvasRenderingContext2D, img: CanvasImageSource, iw: number, ih: number, w: number, h: number) {
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function colorDist(d: Uint8ClampedArray, i: number, r: number, g: number, b: number) {
  return Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b);
}

/** Flood-fill from the edges so only the outer background becomes transparent. */
function cutEdgeBackground(ctx: CanvasRenderingContext2D, w: number, h: number, tolerance: number) {
  const sample = ctx.getImageData(0, 0, w, h);
  const d = sample.data;
  const limit = Math.max(18, tolerance) * 3;
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let qh = 0;
  let qt = 0;

  const push = (x: number, y: number) => {
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    queue[qt++] = p;
  };

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  const seeds: number[] = [];
  const sampleEdge = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    seeds.push(d[i], d[i + 1], d[i + 2]);
  };
  sampleEdge(1, 1);
  sampleEdge(w - 2, 1);
  sampleEdge(1, h - 2);
  sampleEdge(w - 2, h - 2);
  sampleEdge(Math.floor(w / 2), 1);
  sampleEdge(Math.floor(w / 2), h - 2);
  let sr = 0;
  let sg = 0;
  let sb = 0;
  for (let i = 0; i < seeds.length; i += 3) {
    sr += seeds[i];
    sg += seeds[i + 1];
    sb += seeds[i + 2];
  }
  const n = seeds.length / 3;
  sr /= n;
  sg /= n;
  sb /= n;

  while (qh < qt) {
    const p = queue[qh++];
    const x = p % w;
    const y = (p - x) / w;
    const i = p * 4;
    if (colorDist(d, i, sr, sg, sb) > limit) continue;
    d[i + 3] = 0;
    if (x > 0) push(x - 1, y);
    if (x + 1 < w) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y + 1 < h) push(x, y + 1);
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const i = p * 4;
      if (d[i + 3] === 0) continue;
      let empty = 0;
      if (d[((y - 1) * w + x) * 4 + 3] === 0) empty++;
      if (d[((y + 1) * w + x) * 4 + 3] === 0) empty++;
      if (d[(y * w + x - 1) * 4 + 3] === 0) empty++;
      if (d[(y * w + x + 1) * 4 + 3] === 0) empty++;
      if (empty >= 1 && colorDist(d, i, sr, sg, sb) < limit * 1.35) {
        d[i + 3] = empty >= 3 ? 0 : Math.round(d[i + 3] * (1 - empty * 0.28));
      }
    }
  }

  ctx.putImageData(sample, 0, 0);
}

async function aiCutout(sourceUrl: string): Promise<HTMLImageElement | null> {
  try {
    const mod = await import("@imgly/background-removal");
    const removeBackground = mod.removeBackground || mod.default;
    if (!removeBackground) return null;
    const blob = await removeBackground(sourceUrl, {
      model: "isnet_quint8",
      output: { format: "image/png", quality: 0.9 },
    });
    const url = URL.createObjectURL(blob as Blob);
    try {
      return await loadImage(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

export async function applyPhotoBackground(opts: {
  sourceUrl: string;
  color: string;
  bgImageUrl?: string;
  cutout: boolean;
  transparentOnly?: boolean;
  fit: "contain" | "cover";
  fast?: boolean;
}): Promise<{ dataUrl: string; ext: "png" | "jpg" }> {
  const photo = await loadImage(opts.sourceUrl);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(photo.width, photo.height));
  const w = Math.max(1, Math.round(photo.width * scale));
  const h = Math.max(1, Math.round(photo.height * scale));

  const subject = document.createElement("canvas");
  subject.width = w;
  subject.height = h;
  const sctx = subject.getContext("2d", { willReadFrequently: true });
  if (!sctx) throw new Error("Could not edit that photo.");

  if (opts.cutout) {
    const ai = opts.fast ? null : await aiCutout(opts.sourceUrl);
    if (ai) {
      sctx.clearRect(0, 0, w, h);
      sctx.drawImage(ai, 0, 0, w, h);
    } else {
      sctx.drawImage(photo, 0, 0, w, h);
      cutEdgeBackground(sctx, w, h, 34);
    }
  } else {
    sctx.drawImage(photo, 0, 0, w, h);
  }

  if (opts.transparentOnly) {
    return { dataUrl: subject.toDataURL("image/png"), ext: "png" };
  }

  const side = Math.max(w, h);
  const out = document.createElement("canvas");
  out.width = side;
  out.height = side;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Could not edit that photo.");

  ctx.fillStyle = opts.color || "#ffffff";
  ctx.fillRect(0, 0, side, side);
  if (opts.bgImageUrl) {
    const bg = await loadImage(opts.bgImageUrl);
    drawCover(ctx, bg, bg.naturalWidth || bg.width, bg.naturalHeight || bg.height, side, side);
  }

  if (opts.cutout || opts.fit === "contain") {
    drawContain(ctx, subject, w, h, side, side);
  } else {
    drawCover(ctx, photo, photo.naturalWidth || photo.width, photo.naturalHeight || photo.height, side, side);
  }

  return {
    dataUrl: out.toDataURL("image/jpeg", 0.9),
    ext: "jpg",
  };
}
