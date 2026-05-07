export default function ProgressBar({ progress, className = "" }) {
  // Ensure progress is safely bounded between 0 and 100
  const width = Math.min(Math.max(progress || 0, 0), 100);
  
  return (
    <div className={`w-full bg-slate-800 rounded-full h-2 overflow-hidden ${className}`}>
      <div
        className="h-full bg-progress-gradient transition-all duration-500 ease-out flex items-center justify-end"
        style={{ width: `${width}%` }}
      >
        {width > 10 && (
          <div className="w-2 h-2 mr-1 rounded-full bg-white/50 animate-pulse" />
        )}
      </div>
    </div>
  );
}
