import { NextRequest, NextResponse } from "next/server";
import { synthesize } from "@/lib/synthesize";
import { VOICES } from "@/lib/tts";

export const runtime = "nodejs";
export const maxDuration = 120;

const VALID_VOICES = new Set(VOICES.map((v) => v.value));
const RATE_PATTERN = /^[+-]\d{1,3}%$/;
const MAX_TEXT_LENGTH = 2000;

export async function POST(request: NextRequest) {
  let body: { text?: unknown; voice?: unknown; rate?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 }
    );
  }

  const { text, voice, rate } = body;

  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json(
      { error: "Văn bản không được để trống." },
      { status: 400 }
    );
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      {
        error: `Đoạn văn bản quá dài (tối đa ${MAX_TEXT_LENGTH} ký tự mỗi lần gọi).`,
      },
      { status: 400 }
    );
  }
  if (typeof voice !== "string" || !VALID_VOICES.has(voice)) {
    return NextResponse.json(
      { error: "Giọng đọc không hợp lệ." },
      { status: 400 }
    );
  }
  const safeRate = typeof rate === "string" && RATE_PATTERN.test(rate) ? rate : "+0%";

  try {
    const audio = await synthesize({ text, voice, rate: safeRate });
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Lỗi khi sinh giọng đọc:", error);
    return NextResponse.json(
      {
        error:
          "Không thể tạo giọng đọc lúc này. Dịch vụ TTS có thể đang tạm gián đoạn, vui lòng thử lại sau ít phút.",
      },
      { status: 502 }
    );
  }
}
