import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] bg-[#050608] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* --- Background Effects --- */}
      {/* Glow: Smaller on mobile (w-64), larger on desktop (md:w-[500px]) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 md:w-[500px] md:h-[500px] bg-[#d62828] rounded-full opacity-10 blur-[80px] md:blur-[120px] pointer-events-none"></div>

      {/* Texture Grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      ></div>

      {/* --- Main Card --- */}
      {/* Width: full on mobile, max-lg on desktop. Padding: p-6 mobile, p-12 desktop */}
      <div className="relative z-10 w-full max-w-lg bg-[#0f1116]/80 backdrop-blur-xl rounded-2xl md:rounded-3xl p-6 md:p-12 text-center border border-white/5 shadow-2xl shadow-black/50">
        {/* Brand Header */}
        <div className="mb-6 md:mb-8">
          <h3 className="text-lg md:text-xl font-black italic tracking-widest text-white/90">
            SFT KING
          </h3>
          <div className="h-1 w-8 md:w-12 bg-[#d62828] mx-auto mt-2 rounded-full"></div>
        </div>

        {/* 404 Text - Responsive Size */}
        <div className="relative">
          {/* text-7xl on mobile, text-9xl on medium screens+ */}
          <h1 className="text-7xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#ff5e5e] to-[#d62828] drop-shadow-[0_10px_20px_rgba(214,40,40,0.4)] select-none transition-all duration-300">
            404
          </h1>
        </div>

        {/* Error Message */}
        <h2 className="text-lg md:text-2xl font-bold text-white mt-2 md:mt-4 tracking-wide uppercase">
          Page Not Found
        </h2>

        {/* Description - text-sm on mobile, base on desktop */}
        <p className="text-gray-400 mt-3 mb-8 md:mt-4 md:mb-10 text-xs md:text-sm leading-relaxed md:px-4">
          The educational resource you are attempting to access is unavailable.
          Please check your URL or return to the learning portal.
        </p>

        {/* Button - Height and Text adjustment for mobile */}
        <Link
          href="/"
          className="group relative inline-flex items-center justify-center w-full py-3.5 md:py-4 bg-[#d62828] text-white font-bold uppercase tracking-wider text-xs md:text-sm rounded-xl overflow-hidden transition-all duration-300 hover:bg-[#b01f1f] hover:shadow-[0_0_30px_rgba(214,40,40,0.4)] hover:-translate-y-1 active:scale-95"
        >
          {/* Shine animation */}
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"></div>

          <span className="relative z-10 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Return to Dashboard
          </span>
        </Link>

        {/* Footer Support Link */}
        <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-white/5">
          <p className="text-[10px] md:text-xs text-gray-600">
            Need assistance?
          </p>
          <div className="text-[10px] font-bold text-slate-500 hover:text-green-500 flex mt-4 items-center justify-center gap-2 uppercase">
            <a href="tel:+94705370470"> Contact Us - 0705 370 470</a>
          </div>
        </div>
      </div>
    </div>
  );
}
