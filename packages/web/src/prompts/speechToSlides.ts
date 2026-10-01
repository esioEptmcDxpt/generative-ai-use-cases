export type SpeechToSlidesContentType = 'speech' | 'meeting';

export type SpeechToSlidesParams = {
  contentType: SpeechToSlidesContentType;
  additionalInfo?: string;
  additionalInstruction?: string;
};

const COMMON_RULES = `## Writing rules
- The transcript is spoken language produced by speech recognition. It contains fillers, restatements and recognition errors. Never quote it verbatim; extract and organize the points.
- Do not exaggerate or embellish what the speaker said, and do not add your own evaluation or opinion. Keep the original tone (request, report, gratitude, etc.).
- Use person names and organization names as they appear. If a word is obviously a recognition error, you may correct it from context, but if you cannot be sure, keep it as heard. When you corrected terms, add a short note (<p class="note">) on the related slide describing the corrections.
- Do not overload a slide. Keep each bullet short (about one line or two).
- Write all slide text in the same language as the transcript.`;

const MARKUP_RULES = `## Output format
Output ONLY a sequence of <section> elements inside one \`\`\`html code block. Do not output <!DOCTYPE>, <html>, <head>, <style>, <script>, <body>, inline style attributes, external resources (fonts, images, links) or any text outside the code block. The CSS, the cover photo and the footer (page number) are added automatically by the application, so use only the classes below.

### 1. Cover slide (always first, exactly one)
<section class="slide cover">
  <div class="panel">
    <span class="label">(short category label, e.g. "Summary of greeting")</span>
    <h1>(short title of about 20 characters or less; you may use <br> once)</h1>
    <p class="sub">(one-line catch phrase that represents the talk)</p>
    <dl>
      <dt>(item name)</dt><dd>(value)</dd>
      ... (e.g. speaker, date, place. Only items that are known from the transcript or the supplementary information. Never invent them.)
    </dl>
  </div>
</section>

### 2. Normal slide
<section class="slide">
  <div class="topbar"></div>
  <div class="content">
    <div class="head"><span class="num">01</span><h2>(slide title)</h2><span class="lead">(short subtitle)</span></div>
    ... body ...
  </div>
</section>
Use "00" for the table of contents and a star character for the summary slide in <span class="num">.

### Body components
- Cards in columns (2 or 3 cards; the width is adjusted automatically):
  <div class="cols"> <div class="card bg"><h3>(label)</h3><ul><li>...</li></ul></div> <div class="card msg"><h3>...</h3><ul>...</ul><div class="quote">(key phrase)</div></div> <div class="card site"><h3>...</h3><ul>...</ul></div> </div>
  "bg" = gray (background / facts), "msg" = main color (the speaker's message or discussion), "site" = accent color (impact / next actions).
- Table of contents: <div class="toc"><div><b>01</b><span>(topic)<small>(short description)</small></span></div> ... </div>
- Timeline: <div class="timeline"><div>(label)<small>(period)</small></div> ... </div>
- Summary boxes: <div class="summary"><div class="box"><h3>(heading)</h3><p>(text)</p></div> ... </div> followed by <p class="closing">(one-line closing message; wrap the key phrase in <em>)</p>
- Tags: <span class="tag">(speaker name)</span>, <span class="tag decision">(decision label)</span>
- Note: <p class="note">(note)</p>`;

const SPEECH_STRUCTURE = `## Structure
You will receive the transcript of a speech such as a greeting, an address, a morning assembly talk or a lecture.
1. Identify the speaker, their position and the audience from the transcript and the supplementary information.
2. Split the talk into 3 to 6 topics, using the points where the speaker changes the subject.
3. For each topic, organize "background / cause", "the speaker's message or request" and "impact on the workplace (audience)" into the three cards (bg / msg / site). Omit a card if there is nothing to write rather than filling it with guesses.
4. Slide order: cover -> table of contents -> one slide per topic -> summary.`;

const MEETING_STRUCTURE = `## Structure
You will receive the transcript of a meeting (e.g. a web meeting recording). Speaker labels such as "spk_0:" or names may be attached to each utterance.
1. Identify the meeting name, date and participants from the transcript and the supplementary information. If the speakers' names are unknown, use anonymous labels such as "Speaker A" consistently.
2. Split the discussion into 3 to 8 themes, using the points where the topic changes.
3. For each theme, put the discussion (points and opinions, with <span class="tag">speaker</span> where useful) in a "msg" card, background in a "bg" card, and decisions / next actions in a "site" card, marking each decision with <span class="tag decision">Decision</span> (translate the label). If nothing was decided, state that it is under continued consideration.
4. Slide order: cover -> table of contents (themes) -> one slide per theme -> summary (list of all decisions and next actions).`;

export const speechToSlidesPrompt = (params: SpeechToSlidesParams): string => {
  const structure =
    params.contentType === 'meeting' ? MEETING_STRUCTURE : SPEECH_STRUCTURE;

  const additionalInfo =
    params.additionalInfo && params.additionalInfo.trim() !== ''
      ? `\n\n## Supplementary information from the user (use it for the cover and for correcting names)\n<info>\n${params.additionalInfo.trim()}\n</info>`
      : '';

  const additionalInstruction =
    params.additionalInstruction && params.additionalInstruction.trim() !== ''
      ? `\n\n## Additional instructions from the user (follow them with priority)\n<instruction>\n${params.additionalInstruction.trim()}\n</instruction>`
      : '';

  return `You are a professional who summarizes spoken content into clear presentation slides. The user's message is a transcript produced by speech recognition. Summarize it into HTML slides.

${structure}

${COMMON_RULES}

${MARKUP_RULES}${additionalInfo}${additionalInstruction}`;
};
