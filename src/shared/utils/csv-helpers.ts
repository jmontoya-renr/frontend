import type { WithId } from '@/shared/types/with-id'

export function convertToCSV<T extends WithId>(records: Array<T>): string {
  const header = Object.keys(records[0])
  const rows = records.map((record) => {
    return header.map((key) => `"${record[key as keyof T]}"`).join(',')
  })

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
