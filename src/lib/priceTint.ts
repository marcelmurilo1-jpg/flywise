// Meeus/Jones/Butcher Easter algorithm — returns [month (1-based), day]
function easterDate(year: number): [number, number] {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 1-based
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return [month, day]
}

function isFixedHoliday(d: Date): boolean {
  const m = d.getMonth() + 1
  const day = d.getDate()
  return (
    (m === 1  && day === 1)  || // Ano Novo
    (m === 4  && day === 21) || // Tiradentes
    (m === 5  && day === 1)  || // Dia do Trabalho
    (m === 9  && day === 7)  || // Independência
    (m === 10 && day === 12) || // N. Sra. Aparecida
    (m === 11 && day === 2)  || // Finados
    (m === 11 && day === 15) || // Proclamação da República
    (m === 12 && day === 25)    // Natal
  )
}

function isMovingHoliday(d: Date): boolean {
  const year = d.getFullYear()
  const [em, ed] = easterDate(year)
  const easter = new Date(year, em - 1, ed)

  // Good Friday (Sexta Santa): Easter - 2 days
  const goodFriday = new Date(easter)
  goodFriday.setDate(goodFriday.getDate() - 2)

  // Carnaval: Saturday–Tuesday before Ash Wednesday
  const carnavalSat = new Date(easter)
  carnavalSat.setDate(carnavalSat.getDate() - 50)
  const carnavalSun = new Date(easter)
  carnavalSun.setDate(carnavalSun.getDate() - 49)
  const carnavalMon = new Date(easter)
  carnavalMon.setDate(carnavalMon.getDate() - 48)
  const carnavalTue = new Date(easter)
  carnavalTue.setDate(carnavalTue.getDate() - 47)

  // Corpus Christi: Easter + 60 days
  const corpusChristi = new Date(easter)
  corpusChristi.setDate(corpusChristi.getDate() + 60)

  const isSame = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  return (
    isSame(d, easter) ||
    isSame(d, goodFriday) ||
    isSame(d, carnavalSat) ||
    isSame(d, carnavalSun) ||
    isSame(d, carnavalMon) ||
    isSame(d, carnavalTue) ||
    isSame(d, corpusChristi)
  )
}

function isHoliday(d: Date): boolean {
  return isFixedHoliday(d) || isMovingHoliday(d)
}

function isSchoolBreak(d: Date): boolean {
  const year = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()

  // Janeiro inteiro
  if (m === 1) return true

  // Carnaval week (Thursday before through Ash Wednesday)
  const [em, ed] = easterDate(year)
  const easter = new Date(year, em - 1, ed)
  const ashWed = new Date(easter)
  ashWed.setDate(ashWed.getDate() - 46)
  const carnavalThursday = new Date(ashWed)
  carnavalThursday.setDate(carnavalThursday.getDate() - 4)
  const dMs = d.getTime()
  if (dMs >= carnavalThursday.getTime() && dMs <= ashWed.getTime()) return true

  // Semana Santa (Domingo de Ramos até Domingo de Páscoa)
  const palmSunday = new Date(easter)
  palmSunday.setDate(palmSunday.getDate() - 7)
  if (dMs >= palmSunday.getTime() && dMs <= easter.getTime()) return true

  // Julho inteiro
  if (m === 7) return true

  // Recesso de fim de ano: 20/dez – 6/jan (January already covered above)
  if (m === 12 && day >= 20) return true

  return false
}

function isHighDemandDate(d: Date): boolean {
  const m = d.getMonth() + 1
  const day = d.getDate()

  // Dia das Mães: second Sunday of May — mark surrounding Fri–Mon (approx 8–14 mai)
  if (m === 5 && day >= 8 && day <= 14) {
    const dow = d.getDay()
    if (dow === 0 || dow === 5 || dow === 6 || dow === 1) return true
  }

  // Dia dos Namorados: 12/jun ± 2 days
  if (m === 6 && day >= 10 && day <= 14) return true

  // Réveillon: 29/dez–1/jan
  if ((m === 12 && day >= 29) || (m === 1 && day === 1)) return true

  // Semana do Natal: 23–25/dez
  if (m === 12 && day >= 23 && day <= 25) return true

  return false
}

function isBridgeDay(d: Date): boolean {
  const dow = d.getDay()
  // Monday: check if previous Friday was a holiday
  if (dow === 1) {
    const fri = new Date(d)
    fri.setDate(fri.getDate() - 3)
    return isHoliday(fri)
  }
  // Friday: check if following Monday is a holiday
  if (dow === 5) {
    const mon = new Date(d)
    mon.setDate(mon.getDate() + 3)
    return isHoliday(mon)
  }
  return false
}

function isPrePeak(d: Date): boolean {
  const m = d.getMonth() + 1
  const day = d.getDate()
  // Late June before July school break
  return m === 6 && day >= 22 && day <= 30
}

export type PriceTint = 'green' | 'yellow' | 'red'

export function getPriceTint(date: Date): PriceTint {
  const dow = date.getDay() // 0=Sun,1=Mon,...,6=Sat

  if (isHoliday(date))        return 'red'
  if (isSchoolBreak(date))    return 'red'
  if (isHighDemandDate(date)) return 'red'
  if (isBridgeDay(date))      return 'red'
  if (dow === 5 || dow === 0) return 'red'   // sexta ou domingo
  if (dow === 6)              return 'yellow' // sábado
  if (isPrePeak(date))        return 'yellow'
  return 'green'
}
