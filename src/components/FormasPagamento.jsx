import { Banknote, CreditCard, Landmark, QrCode, Wallet } from 'lucide-react';

const FORMAS = [
  { valor: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { valor: 'pix', label: 'Pix', icon: QrCode },
  { valor: 'debito', label: 'Débito', icon: Landmark },
  { valor: 'credito', label: 'Crédito', icon: CreditCard },
  { valor: 'outro', label: 'Outro', icon: Wallet },
];

export default function FormasPagamento({ value, onChange }) {
  return (
    <div className="payment-method-grid">
      {FORMAS.map((f) => (
        <button
          key={f.valor}
          type="button"
          className={'payment-method-btn' + (value === f.valor ? ' is-active' : '')}
          onClick={() => onChange(f.valor)}
        >
          <f.icon size={18} />
          {f.label}
        </button>
      ))}
    </div>
  );
}
