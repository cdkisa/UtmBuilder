export function Button({ children, onClick, variant = 'primary', size = 'md', className = '', disabled = false, type = 'button' }) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-brand-500 hover:bg-brand-600 text-white shadow-sm',
    secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    ghost: 'text-brand-600 hover:bg-brand-50',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2 text-sm',
    lg: 'px-6 py-2.5 text-sm',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
}

export function Input({ label, value, onChange, placeholder, required, disabled, type = 'text', className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-semibold text-brand-600 mb-1">
          {required && <span className="text-red-500 mr-0.5">*</span>}{label}
        </label>
      )}
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-200 outline-none transition disabled:bg-gray-100 disabled:text-gray-500"
      />
    </div>
  );
}

export function Select({ label, value, onChange, options, required, className = '', placeholder }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-semibold text-brand-600 mb-1">
          {required && <span className="text-red-500 mr-0.5">*</span>}{label}
        </label>
      )}
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-200 outline-none transition bg-white">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
            {typeof o === 'string' ? o : o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Checkbox({ label, checked, onChange, className = '' }) {
  return (
    <label className={`flex items-center gap-2 cursor-pointer text-sm text-gray-700 ${className}`}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
      {label}
    </label>
  );
}

export function ComboInput({ label, value, onChange, options = [], placeholder, required, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-semibold text-brand-600 mb-1">
          {required && <span className="text-red-500 mr-0.5">*</span>}{label}
        </label>
      )}
      <div className="relative">
        <input list={`list-${label}`} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-200 outline-none transition" />
        <datalist id={`list-${label}`}>
          {options.map(o => <option key={o} value={o} />)}
        </datalist>
      </div>
    </div>
  );
}

export function EmptyState({ icon, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <div className="w-32 h-32 mb-4 rounded-full bg-gradient-to-br from-brand-50 to-blue-50 flex items-center justify-center">
        <span className="text-5xl opacity-40">{icon || '📋'}</span>
      </div>
      <p className="text-sm mb-4">{message}</p>
      {action}
    </div>
  );
}

export function Badge({ children, color = 'brand' }) {
  const colors = {
    brand: 'bg-brand-100 text-brand-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}
