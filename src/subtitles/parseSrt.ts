/**
 * SRT / SBV subtitle parser.
 * Converts an SRT or SBV file string into an array of timed cue objects.
 *
 * SRT format:
 *   1
 *   00:01:23,456 --> 00:01:27,890
 *   Subtitle text here
 *
 * SBV format (YouTube):
 *   0:00:00.000,0:00:03.140
 *   Subtitle text here
 */

export interface SubtitleCue {
  index: number;
  start: number; // seconds
  end: number;   // seconds
  text: string;
}

/** Parse "HH:MM:SS,mmm" or "HH:MM:SS.mmm" into seconds */
function parseTimestamp(ts: string): number {
  // Accept both comma and dot as millisecond separator
  const clean = ts.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length !== 3) return 0;
  const hh = parseFloat(parts[0]);
  const mm = parseFloat(parts[1]);
  const ss = parseFloat(parts[2]);
  return hh * 3600 + mm * 60 + ss;
}

export function parseSrt(srtText: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];

  // Normalize line endings and split into blocks
  const blocks = srtText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2) continue;

    // First line should be a sequence number (skip if it is)
    let lineIdx = 0;
    const maybeIndex = lines[lineIdx].trim();
    if (/^\d+$/.test(maybeIndex)) {
      lineIdx++;
    }

    // Next line: timing
    if (lineIdx >= lines.length) continue;
    const timingLine = lines[lineIdx].trim();
    const timingMatch = timingLine.match(
      /^(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})/
    );
    if (!timingMatch) continue;

    const start = parseTimestamp(timingMatch[1]);
    const end = parseTimestamp(timingMatch[2]);
    lineIdx++;

    // Remaining lines: subtitle text (strip basic HTML tags like <i>, <b>, <font>)
    const textLines = lines.slice(lineIdx);
    const text = textLines
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim();

    if (text) {
      cues.push({ index: cues.length + 1, start, end, text });
    }
  }

  return cues;
}

/** Find the active cue for a given playback time (with optional offset in seconds). */
export function getActiveCue(
  cues: SubtitleCue[],
  currentTime: number,
  offsetSecs = 0,
): SubtitleCue | null {
  const t = currentTime + offsetSecs;
  for (let i = cues.length - 1; i >= 0; i--) {
    const c = cues[i];
    if (t >= c.start && t < c.end) return c;
  }
  return null;
}

/**
 * SBV parser (YouTube subtitle format).
 *
 * SBV format:
 *   0:00:00.000,0:00:03.140
 *   Subtitle text
 *
 *   0:00:03.500,0:00:06.000
 *   Next subtitle
 */
export function parseSbv(sbvText: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];

  const blocks = sbvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2) continue;

    // First line is the timing: start,end  e.g. 0:00:12.340,0:00:15.000
    const timingLine = lines[0].trim();
    const timingMatch = timingLine.match(
      /^(\d{1,2}:\d{2}:\d{2}\.\d{1,3}),(\d{1,2}:\d{2}:\d{2}\.\d{1,3})/
    );
    if (!timingMatch) continue;

    const start = parseTimestamp(timingMatch[1]);
    const end = parseTimestamp(timingMatch[2]);

    const text = lines
      .slice(1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim();

    if (text) {
      cues.push({ index: cues.length + 1, start, end, text });
    }
  }

  return cues;
}

/**
 * Auto-detect format (SRT or SBV) and parse.
 * SBV timing lines start with  H:MM:SS.mmm,H:MM:SS.mmm  (dot separator, no arrow).
 * Falls back to SRT if format is unclear.
 */
export function parseSubtitles(text: string): SubtitleCue[] {
  const head = text.replace(/\r\n/g, '\n').trimStart().split('\n').slice(0, 6).join('\n');
  const looksLikeSbv = /^\d{1,2}:\d{2}:\d{2}\.\d{1,3},\d{1,2}:\d{2}:\d{2}\.\d{1,3}/m.test(head);
  return looksLikeSbv ? parseSbv(text) : parseSrt(text);
}
