"use client";

import * as React from "react";

export function useSpeechSynthesis() {
  const [enabled, setEnabled] = React.useState(true);
  const [speaking, setSpeaking] = React.useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const cancel = React.useCallback(() => { if (supported) window.speechSynthesis.cancel(); setSpeaking(false); }, [supported]);
  const speak = React.useCallback((text: string) => {
    if (!enabled || !supported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => /^en[-_](UG|GB)/i.test(voice.lang)) ?? voices.find((voice) => /^en/i.test(voice.lang)) ?? null;
    utterance.lang = utterance.voice?.lang ?? "en-GB";
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [enabled, supported]);
  React.useEffect(() => cancel, [cancel]);
  return { enabled, setEnabled, supported, speaking, speak, cancel };
}
