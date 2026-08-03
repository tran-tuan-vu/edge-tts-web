"use client";

import { useEffect, useRef } from "react";

const HEARTS = ["❤️", "💕", "💖", "💗", "💓"];
const SPARKLES = ["✨", "💫", "⭐"];

/**
 * Trang trí thuần thị giác: nền gradient hồng-đỏ, trái tim bay lên, và hạt
 * lấp lánh theo con trỏ chuột. Không chứa logic nghiệp vụ, chỉ thêm/xoá DOM
 * node trong các container pointer-events-none nên không cản tương tác.
 */
export default function LoveEffects() {
  const heartsRef = useRef<HTMLDivElement>(null);
  const sparklesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    const heartsContainer = heartsRef.current;
    const heartInterval = setInterval(() => {
      if (!heartsContainer) return;
      const heart = document.createElement("span");
      heart.textContent = HEARTS[Math.floor(Math.random() * HEARTS.length)];
      heart.className = "love-heart";
      const size = 14 + Math.random() * 18;
      heart.style.left = `${Math.random() * 100}%`;
      heart.style.fontSize = `${size}px`;
      heart.style.setProperty("--love-drift", `${(Math.random() - 0.5) * 160}px`);
      const duration = 7 + Math.random() * 5;
      heart.style.animationDuration = `${duration}s`;
      heart.addEventListener("animationend", () => heart.remove());
      heartsContainer.appendChild(heart);
    }, 900);

    const sparklesContainer = sparklesRef.current;
    let lastSparkleAt = 0;
    function handlePointerMove(e: PointerEvent) {
      const now = performance.now();
      if (now - lastSparkleAt < 60) return;
      lastSparkleAt = now;
      if (!sparklesContainer) return;
      const sparkle = document.createElement("span");
      sparkle.textContent =
        SPARKLES[Math.floor(Math.random() * SPARKLES.length)];
      sparkle.className = "love-sparkle";
      sparkle.style.left = `${e.clientX}px`;
      sparkle.style.top = `${e.clientY}px`;
      sparkle.style.fontSize = `${10 + Math.random() * 8}px`;
      sparkle.addEventListener("animationend", () => sparkle.remove());
      sparklesContainer.appendChild(sparkle);
    }
    window.addEventListener("pointermove", handlePointerMove);

    return () => {
      clearInterval(heartInterval);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  return (
    <>
      <div aria-hidden className="love-bg" />
      <div
        aria-hidden
        ref={heartsRef}
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      />
      <div aria-hidden ref={sparklesRef} className="pointer-events-none" />
    </>
  );
}
