export const BG_SWATCHES = ["#ffffff", "#f1f1f1", "#dacebe", "#db8f2a", "#1a1612", "#0f766e", "#1d4ed8", "#be123c"];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function cutSimilarBackground(ctx: CanvasRenderingContext2D, w: number, h: number, tolerance: number) {
  const sample = ctx.getImageData(0, 0, w, h);
  const d = sample.data;
  const corners = [
    [2, 2],
    [w - 3, 2],
    [2, h - 3],
    [w - 3, h - 3],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [x, y] of corners) {
    const i = (y * w + x) * 4;
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
  }
  r /= 4;
  g /= 4;
  b /= 4;
  const limit = tolerance * 2.55;
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b);
    if (dist < limit * 3) {
      const fade = Math.min(1, dist / (limit * 3));
      d[i + 3] = Math.round(d[i + 3] * fade * fade);
    }
  }
  ctx.putImageData(sample, 0, 0);
}

export async function applyPhotoBackground(opts: {
  sourceUrl: string;
  color: string;
  bgImageUrl?: string;
  cutout: boolean;
  fit: "contain" | "cover";
}): Promise<string> {
  const photo = await loadImage(opts.sourceUrl);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(photo.width, photo.height));
  const w = Math.max(1, Math.round(photo.width * scale));
  const h = Math.max(1, Math.round(photo.height * scale));

  const subject = document.createElement("canvas");
  subject.width = w;
  subject.height = h;
  const sctx = subject.getContext("2d");
  if (!sctx) throw new Error("Could not edit that photo.");
  sctx.drawImage(photo, 0, 0, w, h);
  if (opts.cutout) cutSimilarBackground(sctx, w, h, 28);

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
    drawCover(ctx, bg, side, side);
  }
  if (opts.cutout) {
    const x = Math.round((side - w) / 2);
    const y = Math.round((side - h) / 2);
    ctx.drawImage(subject, x, y);
  } else if (opts.fit === "cover") {
    drawCover(ctx, photo, side, side);
  } else {
    drawContain(ctx, photo, side, side);
  }

  return out.toDataURL("image/jpeg", 0.88);
}
