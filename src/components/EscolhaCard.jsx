export default function EscolhaCard({ selecionado, onClick, icon: Icon, titulo, descricao, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        textAlign: 'left',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 14,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        border: selecionado ? '2px solid var(--primary)' : '1.5px solid var(--border)',
        background: selecionado ? 'color-mix(in srgb, var(--primary) 10%, var(--panel))' : 'var(--panel)',
        transition: 'border-color .15s, background .15s',
      }}
    >
      {Icon && (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: selecionado ? 'var(--primary)' : 'var(--panel-2)',
            color: selecionado ? '#fff' : 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={16} />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: selecionado ? 'var(--primary)' : 'var(--text)' }}>{titulo}</div>
        {descricao && <div className="muted" style={{ fontSize: 11.5, marginTop: 1, lineHeight: 1.3 }}>{descricao}</div>}
      </div>
    </button>
  );
}
