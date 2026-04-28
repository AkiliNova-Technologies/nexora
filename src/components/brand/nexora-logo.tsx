export function NexoraLogo({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-blue-500/10 backdrop-blur ${className}`}
    >
      <span className="text-xl font-bold text-[#3B82F6]">N</span>
    </div>
  );
}