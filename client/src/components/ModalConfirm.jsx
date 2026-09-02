export default function ModalConfirm({ isOpen, title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, isDanger = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none">
      <div className="bg-[#11192e] border border-[#233558] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center animate-in fade-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-xl">
          {isDanger ? '⚠️' : '❓'}
        </div>
        <h3 className="text-lg font-extrabold text-white">{title}</h3>
        <p className="text-slate-300 text-sm leading-relaxed">{message}</p>

        <div className="flex items-center justify-center gap-3 pt-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl bg-[#1e2a47] hover:bg-[#28385e] text-slate-300 text-xs font-bold transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold transition shadow-lg ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-950/50'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
