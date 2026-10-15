/** The rows in each column of the Pipe rack, read down then across; columns that would stay empty are left out. */
export function rackColumns(pipeCount: number, columns: number): number[] {
  const perColumn = Math.ceil(pipeCount / columns);
  const rows: number[] = [];
  for (let left = pipeCount; left > 0; left -= perColumn) rows.push(Math.min(perColumn, left));
  return rows;
}
