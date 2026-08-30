export function inicioDoDia(data = new Date()) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function inicioDoMes(data = new Date()) {
  const d = new Date(data);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
