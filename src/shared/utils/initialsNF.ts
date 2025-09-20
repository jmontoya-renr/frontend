const particles = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'y',
  'da',
  'das',
  'do',
  'dos',
  'di',
  'du',
  'van',
  'von',
  'der',
  'den',
  'el',
])

export function initialsNF(fullName: string): string {
  if (!fullName?.trim()) return ''

  const words = fullName.normalize('NFC').match(/\p{L}+/gu) ?? []
  if (words.length === 0) return ''

  const isParticle = (w: string) => particles.has(w.toLowerCase())

  // Inicial del nombre: primera palabra que no sea partícula
  const nameWord = words.find((w) => !isParticle(w)) ?? words[0]

  // Para el primer apellido: miramos las no-partículas desde el final
  const nonParticlesIdx: Array<number> = []
  for (let i = 0; i < words.length; i++) {
    if (!isParticle(words[i])) nonParticlesIdx.push(i)
  }
  // Caso común: hay al menos dos no-partículas (nombre + apellidos)
  let firstSurnameWord =
    words[
      nonParticlesIdx[nonParticlesIdx.length - 2] ?? nonParticlesIdx[nonParticlesIdx.length - 1]
    ]
  // Si solo hay nombre y un apellido, lo anterior elegiría el nombre; corrige a último
  if (nonParticlesIdx.length === 2) {
    firstSurnameWord = words[nonParticlesIdx[1]]
  }

  const first = [...nameWord!][0].toLocaleUpperCase('es')
  const second = [...firstSurnameWord][0].toLocaleUpperCase('es')
  return first + second
}
