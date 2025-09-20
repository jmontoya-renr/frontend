export function convertToCSV(records: Task[]): string {
  const header = Object.keys(records[0]) // Obtener las claves de las columnas
  const rows = records.map((record) => {
    return header.map((key) => `"${record[key]}"`).join(',') // Crear cada fila en formato CSV
  })

  // Unir cabeceras con las filas de datos
  return [header.join(','), ...rows].join('\n')
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}
