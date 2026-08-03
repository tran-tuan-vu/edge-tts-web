"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoveEffects from "@/app/components/LoveEffects";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Đăng nhập thất bại. Vui lòng thử lại.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="love-card relative z-10 w-full max-w-sm space-y-5 rounded-2xl p-7"
    >
      <div className="space-y-1.5 text-center">
        <span className="love-eyebrow">Truy cập nội bộ</span>
        <h1 className="flex items-baseline justify-center gap-2 text-3xl">
          <span aria-hidden="true">💌</span>
          <span className="love-title">Đăng nhập</span>
        </h1>
        <p className="love-subtitle text-sm">
          Đăng nhập để bắt đầu chuyển văn bản thành giọng đọc.
        </p>
      </div>

      <hr className="love-divider" />

      <div className="space-y-1.5">
        <label htmlFor="username" className="love-label">
          Tên đăng nhập
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="love-input"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="love-label">
          Mật khẩu
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="love-input"
        />
      </div>

      {error && (
        <p role="alert" className="love-alert rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="love-btn-primary w-full rounded-full px-4 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <LoveEffects />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
