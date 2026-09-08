// Padrão único de "carregando" / "nada aqui ainda" — reaproveitado em
// todas as telas que listam dados (mesas, produtos, clientes, estoque...)
// pra parar de cada uma inventar seu próprio texto solto.
export default function EstadoVazio({ icon: Icon, titulo, texto }) {
  return (
    <div className="estado-vazio">
      {Icon && (
        <span className="estado-vazio__icone">
          <Icon size={20} />
        </span>
      )}
      {titulo && <span className="estado-vazio__titulo">{titulo}</span>}
      {texto && <span className="estado-vazio__texto">{texto}</span>}
    </div>
  );
}

export function Carregando({ texto = 'Carregando…' }) {
  return <div className="estado-vazio">{texto}</div>;
}
