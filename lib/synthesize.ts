import { VOICES } from "@/lib/tts";

export interface SynthesizeOptions {
  text: string;
  voice: string;
  rate: string;
}

function parseRatePercent(rate: string): number {
  return parseInt(rate, 10) || 0;
}

/**
 * FPT.AI xử lý audio bất đồng bộ: request trả về JSON chứa link tải, file cần
 * vài giây mới sẵn sàng. Thử lại có giới hạn số lần để tránh treo vô thời hạn
 * nếu link không bao giờ sẵn sàng.
 */
async function synthesizeFpt(text: string, voice: string, ratePercent: number): Promise<Buffer> {
  const key = process.env.FPT_AI_API_KEY;
  if (!key) {
    throw new Error("Thiếu biến môi trường FPT_AI_API_KEY");
  }

  const speed = Math.max(-3, Math.min(3, Math.round((ratePercent / 50) * 3)));

  const res = await fetch("https://api.fpt.ai/hmi/tts/v5", {
    method: "POST",
    headers: {
      "api-key": key,
      voice,
      speed: String(speed),
      "Content-Type": "text/plain; charset=utf-8",
    },
    body: text,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`FPT.AI báo lỗi: HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
  }

  const data = (await res.json()) as { error: number; async?: string; message?: string };
  if (data.error !== 0 || !data.async) {
    throw new Error(`FPT.AI báo lỗi: ${data.message ?? "không rõ nguyên nhân"}`);
  }

  const retryDelaysMs = [300, 500, 800, 1200, 1800, 2500, 3000, 3000, 3000, 3000];
  for (const delayMs of retryDelaysMs) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const audioRes = await fetch(data.async);
    if (audioRes.ok) {
      const arrayBuffer = await audioRes.arrayBuffer();
      if (arrayBuffer.byteLength > 0) {
        return Buffer.from(arrayBuffer);
      }
    }
  }

  throw new Error("FPT.AI xử lý audio quá lâu, vui lòng thử lại.");
}

async function synthesizeElevenLabs(text: string, voice: string, ratePercent: number): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error("Thiếu biến môi trường ELEVENLABS_API_KEY");
  }

  const speed = Math.max(0.7, Math.min(1.2, 1 + ratePercent / 100));

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { speed },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs báo lỗi: HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Điểm truy cập duy nhất để sinh audio từ text. Định tuyến theo nhà cung cấp
 * gắn với từng giọng: FPT.AI cho tiếng Việt, ElevenLabs cho tiếng Anh.
 */
export async function synthesize({ text, voice, rate }: SynthesizeOptions): Promise<Buffer> {
  const voiceInfo = VOICES.find((v) => v.value === voice);
  if (!voiceInfo) {
    throw new Error("Giọng đọc không hợp lệ.");
  }

  const ratePercent = parseRatePercent(rate);

  if (voiceInfo.provider === "fpt") {
    return synthesizeFpt(text, voice, ratePercent);
  }
  return synthesizeElevenLabs(text, voice, ratePercent);
}
