// Ícone de mesa desenhado sob medida (mesa + 2 cadeiras, vista de lado) —
// substitui o ícone genérico de grade (Table2) do lucide em todo lugar que
// representa "mesa" no app. Usa currentColor pra herdar a cor do elemento
// pai, igual aos ícones do lucide-react (aceita a mesma prop `size`).
export default function IconeMesa({ size = 16, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} {...props}>
      <rect x="2.3" y="4.6" width="3.2" height="8" rx="1.4" />
      <rect x="18.5" y="4.6" width="3.2" height="8" rx="1.4" />
      <path d="M2.6 12.4c.4 2.6 1.4 6.5 1.4 6.5h1.8s.7-4 .9-6.5z" />
      <path d="M21.4 12.4c-.4 2.6-1.4 6.5-1.4 6.5h-1.8s-.7-4-.9-6.5z" />
      <rect x="6.8" y="9.6" width="10.4" height="2.6" rx="1.3" />
      <rect x="10.8" y="12.2" width="2.4" height="4.6" />
      <rect x="8.6" y="16.8" width="6.8" height="1.6" rx="0.8" />
    </svg>
  );
}
