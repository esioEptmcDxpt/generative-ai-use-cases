// Utilities for the "speech to slides" use case.
// The LLM outputs only <section> elements. The CSS, the cover photo and the footer
// are added here so that the layout does not depend on the model.

const SLIDES_CSS = `
:root {
  --green: #1f6b3a;
  --green-dark: #144a28;
  --green-light: #e8f2eb;
  --accent: #d98a1c;
  --bg: #faf8f5;
  --text: #1a1a1a;
  --muted: #666;
  --line: #d9d4cc;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-snap-type: y mandatory; overflow-y: scroll; }
body {
  font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", Meiryo, sans-serif;
  background: #333; color: var(--text); line-height: 1.7;
}
section.slide {
  scroll-snap-align: start;
  width: 100vw; height: 100vh;
  background: var(--bg);
  display: flex; flex-direction: column;
  position: relative; overflow: hidden;
}
.topbar { height: 10px; background: linear-gradient(90deg, var(--green) 0 80%, var(--accent) 80% 100%); flex-shrink: 0; }
.content { flex: 1; padding: 5vh 6vw 3vh; display: flex; flex-direction: column; min-height: 0; }
.footer {
  height: 5vh; flex-shrink: 0; padding: 0 6vw;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 0.8rem; color: var(--muted); border-top: 1px solid var(--line);
}

/* Cover */
section.slide.cover { flex-direction: row; }
.cover .photo { flex: 1.8; background: var(--green-dark); display: flex; align-items: center; overflow: hidden; }
.cover .frame { position: relative; width: 100%; flex-shrink: 0; }
.cover .frame img { display: block; width: 100%; height: auto; }
.cover .frame::after { content: ""; position: absolute; inset: 0; background:
  linear-gradient(180deg, var(--green-dark) 0, rgba(20,74,40,0) 6%, rgba(20,74,40,0) 94%, var(--green-dark) 100%),
  linear-gradient(90deg, rgba(20,74,40,0) 96%, var(--green-dark) 100%); }
.cover .panel {
  flex: 1; background: var(--green-dark); color: #fff;
  padding: 8vh 4vw; display: flex; flex-direction: column; justify-content: center;
}
section.slide.cover.no-photo .panel {
  padding: 10vh 12vw;
  background: linear-gradient(135deg, var(--green-dark) 0 70%, var(--green) 70% 100%);
  border-top: 10px solid var(--accent);
}
.cover .label { display: inline-block; align-self: flex-start; background: var(--accent); color: #fff; font-size: 0.9rem; font-weight: bold; padding: 0.25em 0.9em; border-radius: 3px; margin-bottom: 3vh; }
.cover h1 { font-size: clamp(1.8rem, 3.4vw, 3rem); line-height: 1.35; margin-bottom: 2vh; }
.cover.no-photo h1 { font-size: clamp(2.2rem, 4.5vw, 4rem); }
.cover .sub { font-size: clamp(1rem, 1.4vw, 1.3rem); opacity: 0.9; margin-bottom: 5vh; }
.cover dl { display: grid; grid-template-columns: auto 1fr; gap: 1vh 1.5vw; font-size: clamp(0.9rem, 1.1vw, 1.05rem); border-top: 1px solid rgba(255,255,255,0.3); padding-top: 3vh; }
.cover dt { color: #f3c77f; font-weight: bold; }

/* Heading */
.head { display: flex; align-items: baseline; gap: 1.5vw; margin-bottom: 4vh; border-bottom: 2px solid var(--green); padding-bottom: 1.5vh; }
.num { font-size: clamp(2.6rem, 5vw, 4.5rem); font-weight: 800; color: var(--green); line-height: 1; font-family: "Helvetica Neue", Arial, sans-serif; }
.head h2 { font-size: clamp(1.4rem, 2.4vw, 2.2rem); color: var(--green-dark); }
.head .lead { margin-left: auto; font-size: 0.95rem; color: var(--muted); }

/* Cards */
.cols { display: flex; gap: 2vw; align-items: stretch; margin: auto 0; min-height: 44vh; }
.cols > .card { flex: 1 1 0; min-width: 0; }
.card { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 3vh 1.6vw; display: flex; flex-direction: column; }
.card h3 { font-size: 0.95rem; display: inline-block; align-self: flex-start; padding: 0.2em 0.8em; border-radius: 999px; margin-bottom: 2vh; }
.card.bg h3 { background: #ecebe8; color: var(--text); }
.card.msg h3 { background: var(--green); color: #fff; }
.card.site h3 { background: var(--accent); color: #fff; }
.card.msg { border-top: 4px solid var(--green); }
.card ul { list-style: none; font-size: clamp(0.95rem, 1.2vw, 1.15rem); }
.card li { padding-left: 1.2em; position: relative; margin-bottom: 1.4vh; }
.card li::before { content: ""; position: absolute; left: 0.2em; top: 0.7em; width: 0.45em; height: 0.45em; background: var(--green); border-radius: 50%; }
.card.site li::before { background: var(--accent); }
.quote { margin-top: auto; background: var(--green-light); border-left: 4px solid var(--green); padding: 1.5vh 1vw; font-size: 0.95rem; color: var(--green-dark); }
.note { font-size: 0.78rem; color: var(--muted); margin-top: 1.5vh; }
.tag { display: inline-block; font-size: 0.78rem; padding: 0.05em 0.7em; margin-right: 0.4em; border-radius: 999px; background: #ecebe8; color: var(--text); vertical-align: 0.1em; }
.tag.decision { background: var(--accent); color: #fff; font-weight: bold; }

/* Table of contents */
.toc { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5vh 4vw; margin-top: 2vh; }
.toc div { display: flex; align-items: center; gap: 1.2vw; padding: 2vh 1.5vw; background: #fff; border: 1px solid var(--line); border-radius: 8px; }
.toc b { font-size: 2rem; color: var(--green); font-family: "Helvetica Neue", Arial, sans-serif; }
.toc span { font-size: clamp(1rem, 1.3vw, 1.2rem); font-weight: bold; }
.toc small { display: block; font-weight: normal; color: var(--muted); font-size: 0.85rem; }

/* Timeline */
.timeline { display: flex; margin: 2vh 0 4vh; }
.timeline div { flex: 1; text-align: center; padding: 2vh 1vw; color: #fff; font-weight: bold; background: var(--green); }
.timeline div:nth-child(odd) { background: var(--green-dark); }
.timeline div:last-child { background: var(--accent); }
.timeline small { display: block; font-weight: normal; font-size: 0.85rem; opacity: 0.9; }

/* Summary */
.summary { margin-top: auto; display: flex; gap: 2vw; }
.summary .box { flex: 1 1 0; min-width: 0; min-height: 30vh; background: #fff; border-radius: 8px; border: 1px solid var(--line); padding: 3vh 1.6vw; }
.summary .box h3 { color: var(--green-dark); font-size: 1.15rem; margin-bottom: 1.5vh; padding-bottom: 1vh; border-bottom: 2px solid var(--accent); }
.summary .box p { font-size: clamp(0.95rem, 1.15vw, 1.1rem); }
.closing { margin: 6vh 0 auto; text-align: center; font-size: clamp(1.2rem, 2vw, 1.8rem); font-weight: bold; color: var(--green-dark); }
.closing em { font-style: normal; color: var(--accent); }
`;

// Extract the HTML from the LLM response (```html code block, or the raw text)
export const extractSlidesMarkup = (response: string): string => {
  const block = response.match(/```(?:html)?\s*\n([\s\S]*?)(?:```|$)/);
  return (block ? block[1] : response).trim();
};

// Remove scripts, event handlers and external resources from the generated markup
const sanitize = (root: HTMLElement) => {
  root
    .querySelectorAll(
      'script, iframe, object, embed, link, meta, style, base, form, img'
    )
    .forEach((el) => el.remove());
  root.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (
        name.startsWith('on') ||
        name === 'style' ||
        name === 'src' ||
        name === 'srcset' ||
        ((name === 'href' || name === 'xlink:href') && !value.startsWith('#'))
      ) {
        el.removeAttribute(attr.name);
      }
    });
  });
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export type BuiltSlides = {
  html: string;
  title: string;
  pageCount: number;
};

// Build a self-contained HTML document from the LLM markup
export const buildSlidesHtml = (
  markup: string,
  photoDataUrl: string | null,
  lang: string
): BuiltSlides => {
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${markup}</body></html>`,
    'text/html'
  );
  const body = doc.body;
  sanitize(body);

  const slides = Array.from(body.querySelectorAll('section.slide'));
  const cover = body.querySelector('section.slide.cover');
  const h1 = cover?.querySelector('h1')?.cloneNode(true) as
    | HTMLElement
    | undefined;
  h1?.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
  const title = (h1?.textContent ?? '').replace(/\s+/g, ' ').trim();

  // Cover photo
  if (cover) {
    cover.querySelector('.photo')?.remove();
    if (photoDataUrl) {
      cover.classList.remove('no-photo');
      const photo = doc.createElement('div');
      photo.className = 'photo';
      const frame = doc.createElement('div');
      frame.className = 'frame';
      const img = doc.createElement('img');
      img.setAttribute('src', photoDataUrl);
      img.setAttribute('alt', '');
      frame.appendChild(img);
      photo.appendChild(frame);
      cover.insertBefore(photo, cover.firstChild);
    } else {
      cover.classList.add('no-photo');
    }
  }

  // Footer with page numbers (except the cover)
  slides.forEach((slide, idx) => {
    slide.querySelectorAll(':scope > .footer').forEach((el) => el.remove());
    if (slide === cover) return;
    const footer = doc.createElement('div');
    footer.className = 'footer';
    const label = doc.createElement('span');
    label.textContent = title;
    const page = doc.createElement('span');
    page.textContent = `${idx + 1} / ${slides.length}`;
    footer.appendChild(label);
    footer.appendChild(page);
    slide.appendChild(footer);
  });

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${SLIDES_CSS}</style>
</head>
<body>
${body.innerHTML}
</body>
</html>
`;

  return { html, title, pageCount: slides.length };
};

// Resize the photo in the browser (EXIF orientation is applied by the browser)
export const resizeImageToDataUrl = async (
  file: File,
  maxSize = 2000,
  quality = 0.85
): Promise<string> => {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', quality);
};

// File name for download
export const slidesFileName = (title: string): string => {
  const safe = title.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 50);
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${safe || 'slides'}_${ymd}.html`;
};
