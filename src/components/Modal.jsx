export default function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal-box ${width} w-full mx-4`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-lg font-display font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1">&times;</button>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}
