export default function Header({ onMenuClick }) {
  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
          aria-label="Open menu"
        >
          <span className="text-xl leading-none">☰</span>
        </button>
        <h1 className="text-sm font-display font-bold text-gray-800">UTM Builder</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs">
          A
        </div>
      </div>
    </header>
  );
}
