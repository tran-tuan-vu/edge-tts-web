export type Lang = "vi" | "en";
export type Provider = "fpt" | "elevenlabs";

export interface Voice {
  value: string;
  label: string;
  lang: Lang;
  provider: Provider;
}

// Giọng tiếng Việt từ FPT.AI Text-to-Speech (https://docs.fpt.ai/docs/en/speech/api/text-to-speech.html)
// và giọng tiếng Anh từ ElevenLabs premade voices (https://elevenlabs.io/docs/api-reference/text-to-speech).
export const VOICES: Voice[] = [
  { value: "banmai", label: "Ban Mai — nữ, miền Bắc", lang: "vi", provider: "fpt" },
  { value: "thuminh", label: "Thu Minh — nữ, miền Bắc", lang: "vi", provider: "fpt" },
  { value: "leminh", label: "Lê Minh — nam, miền Bắc", lang: "vi", provider: "fpt" },
  { value: "myan", label: "Mỹ An — nữ, miền Trung", lang: "vi", provider: "fpt" },
  { value: "giahuy", label: "Gia Huy — nam, miền Trung", lang: "vi", provider: "fpt" },
  { value: "lannhi", label: "Lan Nhi — nữ, miền Nam", lang: "vi", provider: "fpt" },
  { value: "linhsan", label: "Linh San — nữ, miền Nam", lang: "vi", provider: "fpt" },
  { value: "EXAVITQu4vr4xnSDxMaL", label: "Sarah — nữ, giọng Mỹ", lang: "en", provider: "elevenlabs" },
  { value: "cgSgspJ2msm6clMCkdW9", label: "Jessica — nữ, giọng Mỹ", lang: "en", provider: "elevenlabs" },
  { value: "XrExE9yKIg1WjnnlVkGX", label: "Matilda — nữ, giọng Mỹ", lang: "en", provider: "elevenlabs" },
  { value: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice — nữ, giọng Anh", lang: "en", provider: "elevenlabs" },
  { value: "pNInz6obpgDQGcFmaJgB", label: "Adam — nam, giọng Mỹ", lang: "en", provider: "elevenlabs" },
  { value: "cjVigY5qzO86Huf0OWal", label: "Eric — nam, giọng Mỹ", lang: "en", provider: "elevenlabs" },
  { value: "CwhRBWXzGAHq8TQ4Fs17", label: "Roger — nam, giọng Mỹ", lang: "en", provider: "elevenlabs" },
  { value: "JBFqnCBsd6RMkjVDRZzb", label: "George — nam, giọng Anh", lang: "en", provider: "elevenlabs" },
];

export const MAX_CHUNK = 1200;

export interface TTSSegment {
  lang: Lang;
  text: string;
}

/**
 * Tách văn bản thành các đoạn theo dòng, toàn bộ văn bản đọc bằng một ngôn
 * ngữ duy nhất (chọn qua nút bấm trên giao diện). Gộp các dòng liền kề để
 * giảm số lần gọi API, miễn tổng độ dài không vượt MAX_CHUNK.
 */
export function parseSegments(raw: string, lang: Lang): TTSSegment[] {
  const lines = raw.split(/\r?\n/);
  const rawSegments: TTSSegment[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    rawSegments.push({ lang, text: trimmed });
  }

  const merged: TTSSegment[] = [];
  for (const seg of rawSegments) {
    const last = merged[merged.length - 1];
    if (last && last.text.length + 1 + seg.text.length <= MAX_CHUNK) {
      last.text = `${last.text} ${seg.text}`;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

const SENTENCE_BOUNDARY = /(?<=[.!?…;:])\s+/;

/**
 * Cắt một đoạn dài hơn MAX_CHUNK theo ranh giới câu. Chỉ cắt cứng (giữa câu)
 * khi bản thân một câu đã vượt quá MAX_CHUNK.
 */
export function splitLong(segment: TTSSegment): TTSSegment[] {
  if (segment.text.length <= MAX_CHUNK) return [segment];

  const sentences = segment.text.split(SENTENCE_BOUNDARY);
  const chunks: TTSSegment[] = [];
  let current = "";

  const flush = () => {
    if (current) {
      chunks.push({ lang: segment.lang, text: current });
      current = "";
    }
  };

  for (const sentence of sentences) {
    if (sentence.length > MAX_CHUNK) {
      flush();
      for (let i = 0; i < sentence.length; i += MAX_CHUNK) {
        chunks.push({ lang: segment.lang, text: sentence.slice(i, i + MAX_CHUNK) });
      }
      continue;
    }
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > MAX_CHUNK) {
      flush();
      current = sentence;
    } else {
      current = candidate;
    }
  }
  flush();

  return chunks;
}

export function buildChunks(raw: string, lang: Lang): TTSSegment[] {
  return parseSegments(raw, lang).flatMap(splitLong);
}

const CHARS_PER_SECOND = 14;

export function estimateSeconds(text: string, ratePercent: number = 0): number {
  const baseSeconds = text.length / CHARS_PER_SECOND;
  const factor = 1 + ratePercent / 100;
  return factor > 0 ? baseSeconds / factor : baseSeconds;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (minutes === 0) return `${secs} giây`;
  return `${minutes} phút ${secs} giây`;
}

function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function toFileName(text: string): string {
  const words = removeVietnameseTones(text.trim().slice(0, 60))
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const slug = words.join("-") || "audio";
  return `${slug}.mp3`;
}
