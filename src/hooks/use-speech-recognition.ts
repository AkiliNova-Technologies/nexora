"use client";

import * as React from "react";

interface RecognitionEventLike { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }
interface RecognitionErrorLike { error: string }
interface BrowserRecognition {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecognitionConstructor = new () => BrowserRecognition;

declare global { interface Window { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor } }

export function useSpeechRecognition(onFinal: (text: string) => void, language = "en-UG") {
  const recognitionRef = React.useRef<BrowserRecognition | null>(null);
  const finalRef = React.useRef(onFinal);
  const [supported, setSupported] = React.useState<boolean | null>(null);
  const [listening, setListening] = React.useState(false);
  const [interim, setInterim] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { finalRef.current = onFinal; }, [onFinal]);

  React.useEffect(() => {
    const Constructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    // Browser support is external state and is only knowable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(Boolean(Constructor));
    if (!Constructor) return;
    const recognition = new Constructor();
    recognition.lang = language;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setInterim(interimText.trim());
      if (finalText.trim()) finalRef.current(finalText.trim());
    };
    recognition.onerror = ({ error: code }) => {
      setError(code === "not-allowed" || code === "service-not-allowed" ? "Microphone permission was denied." : code === "audio-capture" ? "No microphone is available." : `Speech recognition stopped (${code}).`);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => { recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.abort(); recognitionRef.current = null; };
  }, [language]);

  const start = React.useCallback(() => {
    if (!recognitionRef.current || listening) return;
    setError(null); setInterim("");
    try { recognitionRef.current.start(); setListening(true); } catch { setError("Speech recognition could not start."); }
  }, [listening]);
  const stop = React.useCallback(() => { recognitionRef.current?.stop(); setListening(false); }, []);
  return { supported, listening, interim, error, start, stop };
}
