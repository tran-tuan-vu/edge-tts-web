"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  VOICES,
  buildChunks,
  estimateSeconds,
  formatDuration,
  toFileName,
  type Lang,
} from "@/lib/tts";
import LoveEffects from "./components/LoveEffects";

const CONCURRENCY = 3;
const PREVIEW_MAX_CHARS = 220;

function formatRate(ratePercent: number): string {
  return `${ratePercent >= 0 ? "+" : ""}${ratePercent}%`;
}

/** Cắt đoạn xem trước về gần ranh giới từ gần nhất để tránh cụt giữa từ. */
function truncateForPreview(text: string, maxLen: number = PREVIEW_MAX_CHARS): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated).trim();
}

interface Progress {
  done: number;
  total: number;
}

export default function HomePage() {
  const router = useRouter();

  const [text, setText] = useState("");
  const [lang, setLang] = useState<Lang>("vi");
  const [viVoice, setViVoice] = useState(
    VOICES.find((v) => v.lang === "vi")!.value
  );
  const [enVoice, setEnVoice] = useState(
    VOICES.find((v) => v.lang === "en")!.value
  );
  const [ratePercent, setRatePercent] = useState(0);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("audio.mp3");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  const charCount = text.length;
  const estimatedDuration = useMemo(
    () => formatDuration(estimateSeconds(text, ratePercent)),
    [text, ratePercent]
  );

  async function handleGenerate() {
    const chunks = buildChunks(text, lang);
    if (chunks.length === 0) {
      setError("Vui lòng nhập văn bản trước khi tạo giọng đọc.");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    cancelledRef.current = false;

    setIsGenerating(true);
    setError(null);
    setProgress({ done: 0, total: chunks.length });

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    const results: (Blob | null)[] = new Array(chunks.length).fill(null);
    let nextIndex = 0;
    let completed = 0;
    let firstError: Error | null = null;

    async function worker() {
      while (true) {
        const i = nextIndex++;
        if (i >= chunks.length) return;
        if (controller.signal.aborted) return;

        const chunk = chunks[i];
        const voice = lang === "vi" ? viVoice : enVoice;

        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: chunk.text,
              voice,
              rate: formatRate(ratePercent),
            }),
            signal: controller.signal,
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(
              data.error ?? `Lỗi khi tạo đoạn ${i + 1}/${chunks.length}.`
            );
          }
          results[i] = await res.blob();
          completed += 1;
          setProgress({ done: completed, total: chunks.length });
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          if (!firstError) {
            firstError = err instanceof Error ? err : new Error(String(err));
            controller.abort();
          }
          return;
        }
      }
    }

    const workerCount = Math.min(CONCURRENCY, chunks.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    setIsGenerating(false);
    abortControllerRef.current = null;

    if (cancelledRef.current) {
      setError("Đã huỷ tạo giọng đọc.");
      setProgress(null);
      return;
    }

    if (firstError) {
      setError((firstError as Error).message);
      setProgress(null);
      return;
    }

    const blob = new Blob(results as Blob[], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    setFileName(toFileName(text));
  }

  function handleCancel() {
    cancelledRef.current = true;
    abortControllerRef.current?.abort();
  }

  async function handlePreview() {
    const chunks = buildChunks(text, lang);
    if (chunks.length === 0) {
      setError("Vui lòng nhập văn bản trước khi nghe thử.");
      return;
    }

    setError(null);
    setIsPreviewing(true);
    try {
      const firstChunk = chunks[0];
      const voice = lang === "vi" ? viVoice : enVoice;
      const previewText = truncateForPreview(firstChunk.text);

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: previewText,
          voice,
          rate: formatRate(ratePercent),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Không thể tạo giọng nghe thử.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.addEventListener("ended", () => URL.revokeObjectURL(url));
      await audio.play();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể tạo giọng nghe thử."
      );
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <LoveEffects />
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-7 px-4 py-10">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <span className="love-eyebrow">Công cụ song ngữ Việt–Anh</span>
            <h1 className="flex flex-wrap items-baseline gap-2 text-3xl sm:text-4xl">
              <span aria-hidden="true">💌</span>
              <span className="love-title">Chuyển văn bản thành giọng đọc</span>
            </h1>
            <p className="love-subtitle text-sm">
              Dán đoạn văn, chọn giọng, và nghe câu chữ cất tiếng.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="love-btn-ghost shrink-0 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
          </button>
        </header>

        <section className="love-card space-y-3 rounded-2xl p-5">
          <span className="love-label">Ngôn ngữ đọc</span>
          <div className="love-chip-group">
            <button
              type="button"
              onClick={() => setLang("vi")}
              aria-pressed={lang === "vi"}
              className={`love-chip ${lang === "vi" ? "love-chip-active" : ""}`}
            >
              Tiếng Việt
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              aria-pressed={lang === "en"}
              className={`love-chip ${lang === "en" ? "love-chip-active" : ""}`}
            >
              Tiếng Anh
            </button>
          </div>
        </section>

        <section className="love-card space-y-3 rounded-2xl p-5">
          <label htmlFor="text" className="love-label">
            Văn bản
          </label>
          <textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder={
              lang === "vi"
                ? "Nhập văn bản tiếng Việt..."
                : "Enter English text..."
            }
            className="love-input resize-y"
          />
          <div className="flex items-center justify-between">
            <p className="love-meta">
              {charCount.toLocaleString("vi-VN")} ký tự
            </p>
            <p className="love-meta">≈ {estimatedDuration} audio</p>
          </div>
        </section>

        <section className="love-card space-y-3 rounded-2xl p-5">
          <label htmlFor="voice" className="love-label">
            {lang === "vi" ? "Giọng tiếng Việt" : "Giọng tiếng Anh"}
          </label>
          <select
            id="voice"
            value={lang === "vi" ? viVoice : enVoice}
            onChange={(e) =>
              lang === "vi"
                ? setViVoice(e.target.value)
                : setEnVoice(e.target.value)
            }
            className="love-select"
          >
            {VOICES.filter((v) => v.lang === lang).map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </section>

        <section className="love-card space-y-3 rounded-2xl p-5">
          <label htmlFor="rate" className="love-label">
            Tốc độ đọc:{" "}
            <span className="font-normal text-[var(--rose-deep)]">
              {formatRate(ratePercent)}
            </span>
          </label>
          <input
            id="rate"
            type="range"
            min={-50}
            max={50}
            step={5}
            value={ratePercent}
            onChange={(e) => setRatePercent(Number(e.target.value))}
            className="love-range"
          />
          <div className="flex justify-between">
            <span className="love-meta">Chậm</span>
            <span className="love-meta">Nhanh</span>
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || isPreviewing || text.trim().length === 0}
            className="love-btn-primary rounded-full px-6 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? "Đang tạo giọng đọc…" : "💖 Tạo giọng đọc"}
          </button>
          {isGenerating && (
            <button
              type="button"
              onClick={handleCancel}
              className="love-btn-secondary rounded-full px-5 py-2.5 font-medium"
            >
              Huỷ
            </button>
          )}
          <button
            type="button"
            onClick={handlePreview}
            disabled={isGenerating || isPreviewing || text.trim().length === 0}
            title="Đọc thử đoạn đầu của văn bản bạn vừa nhập"
            className="love-btn-secondary rounded-full px-5 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPreviewing ? "Đang tạo giọng nghe thử…" : "🎧 Nghe thử"}
          </button>
        </section>

        {progress && isGenerating && (
          <section className="space-y-1.5">
            <p className="love-meta">
              Đang xử lý đoạn {progress.done}/{progress.total}
            </p>
            <div className="love-progress-track h-2 w-full overflow-hidden rounded-full">
              <div
                className="love-progress-bar h-full motion-reduce:transition-none transition-[width]"
                style={{
                  width: `${Math.round((progress.done / progress.total) * 100)}%`,
                }}
              />
            </div>
          </section>
        )}

        {error && (
          <p role="alert" className="love-alert rounded-md px-3 py-2 text-sm">
            {error}
          </p>
        )}

        {audioUrl && (
          <section className="love-card space-y-3 rounded-2xl p-5">
            <span className="love-label">Kết quả</span>
            <audio controls src={audioUrl} className="w-full" />
            <a
              href={audioUrl}
              download={fileName}
              className="love-btn-primary inline-block rounded-full px-5 py-2 text-sm font-semibold"
            >
              Tải xuống
            </a>
          </section>
        )}
      </main>
    </>
  );
}
