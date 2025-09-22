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

  const nameWord = words.find((w) => !isParticle(w)) ?? words[0]

  const nonParticlesIdx: Array<number> = []
  for (let i = 0; i < words.length; i++) {
    if (!isParticle(words[i])) nonParticlesIdx.push(i)
  }
  let firstSurnameWord =
    words[
      nonParticlesIdx[nonParticlesIdx.length - 2] ?? nonParticlesIdx[nonParticlesIdx.length - 1]
    ]
  if (nonParticlesIdx.length === 2) {
    firstSurnameWord = words[nonParticlesIdx[1]]
  }

  const first = [...nameWord!][0].toLocaleUpperCase('es')
  const second = [...firstSurnameWord][0].toLocaleUpperCase('es')
  return first + second
}
