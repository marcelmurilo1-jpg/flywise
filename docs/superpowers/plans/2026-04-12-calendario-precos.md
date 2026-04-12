# Calendário de Preços Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Color-code calendar dates in the existing `DateRangePicker` with subtle green/yellow/red tints based on static Brazilian demand patterns (holidays, school breaks, day-of-week), loading instantly with no API calls.

**Architecture:** A pure function `getPriceTint(date)` in `src/lib/priceTint.ts` encapsulates all demand logic. `DateRangePicker.tsx` imports it and applies a light background tint + small colored dot to each day cell. No new state, no network calls.

**Tech Stack:** TypeScript, React (inline styles — no Tailwind/CSS modules), date-fns (already installed)

---

## File Map

- **Create: `src/lib/priceTint.ts`** — `getPriceTint(date: Date): 'green' | 'yellow' | 'red'` + all helper logic (Easter calculation, holiday check, school-break check)
- **Modify: `src/components/DateRangePicker.tsx`** — import `getPriceTint`, apply tint background + dot in the day cell render, add legend below the calendars

---

### Task 1: Create `src/lib/priceTint.ts`

**Files:**
- Create: `src/lib/priceTint.ts`

#### Context

This file is pure TypeScript with no imports from React or the DOM — only from `date-fns` (already in the project). It exports one public function. All helpers are unexported.

The priority order for tint assignment (first match wins):
1. National holiday / major holiday period → `'red'`
2. School vacation period → `'red'`
3. High-demand dates (Dia das Mães, Namorados, Natal, Réveillon) and their surrounding days → `'red'`
4. Bridge day (weekday sandwiched between holiday and weekend) → `'red'`
5. Friday or Sunday → `'red'`
6. Saturday → `'yellow'`
7. Pre-peak period (late June heading into July school break) → `'yellow'`
8. Everything else (Mon–Thu outside high periods) → `'green'`

- [ ] **Step 1: Create the file with the Easter algorithm and holiday checker**

Create `src/lib/priceTint.ts` with this exact content:

```ts
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

function sameDay(d: Date, month: number, day: number): boolean {
  return d.getMonth() + 1 === month && d.getDate() === day
}

function isFixedHoliday(d: Date): boolean {
  const m = d.getMonth() + 1
  const day = d.getDate()
  // Fixed national holidays
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

  // Carnaval: Easter - 47 days (segunda) and - 46 days (terça)
  const carnavalMon = new Date(easter)
  carnavalMon.setDate(carnavalMon.getDate() - 48)
  const carnavalTue = new Date(easter)
  carnavalTue.setDate(carnavalTue.getDate() - 47)
  const carnavalSun = new Date(easter)
  carnavalSun.setDate(carnavalSun.getDate() - 49)
  const carnavalSat = new Date(easter)
  carnavalSat.setDate(carnavalSat.getDate() - 50)

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
    isSame(d, carnavalMon) ||
    isSame(d, carnavalTue) ||
    isSame(d, carnavalSun) ||
    isSame(d, carnavalSat) ||
    isSame(d, corpusChristi)
  )
}

function isHoliday(d: Date): boolean {
  return isFixedHoliday(d) || isMovingHoliday(d)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /path/to/project && npx tsc --noEmit --skipLibCheck
```

Expected: no errors related to `priceTint.ts`

- [ ] **Step 3: Add school break checker**

Append to `src/lib/priceTint.ts`:

```ts
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

  // Recesso de fim de ano: 20/dez – 6/jan (already covered by January above)
  if (m === 12 && day >= 20) return true

  return false
}
```

- [ ] **Step 4: Add high-demand date checker**

Append to `src/lib/priceTint.ts`:

```ts
function isHighDemandDate(d: Date): boolean {
  const m = d.getMonth() + 1
  const day = d.getDate()

  // Dia das Mães: second Sunday of May — mark the whole surrounding weekend (Fri–Mon)
  // Approximate: 8–14 de maio
  if (m === 5 && day >= 8 && day <= 14) {
    const dow = d.getDay() // 0=Sun,5=Fri,6=Sat
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
```

- [ ] **Step 5: Add bridge-day checker and export `getPriceTint`**

Append to `src/lib/priceTint.ts`:

```ts
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
```

- [ ] **Step 6: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit --skipLibCheck
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/priceTint.ts
git commit -m "feat(calendar): add getPriceTint static demand heuristic"
```

---

### Task 2: Integrate tints into `DateRangePicker.tsx`

**Files:**
- Modify: `src/components/DateRangePicker.tsx`

#### Context

`DateRangePicker.tsx` contains a `Calendar` sub-component (lines 47–180). Inside it, each day is rendered as a `<button>` wrapping a `<div>` wrapping another `<div>` that holds the date number. All styling is via inline styles (no Tailwind classes in this file).

The tint must only apply to:
- days that are **not** past (`!isPast`)
- days that are **in the current month** (`inCurMonth`)
- days that are **not selected** as start or end (selected state overrides with navy background)
- days that are **not in range** (range highlight overrides with `#EEF4FF`)

The tint is applied to the **inner `<div>`** (the one that currently holds `background: bg`). When tint is active and the day is not selected/range, replace the `bg` value.

Additionally, add a tiny colored dot (4×4 px circle) below the number, visible only when tint is active and day is not selected.

Finally, add a legend row below the two calendar columns inside `calendarPanel`.

- [ ] **Step 1: Import `getPriceTint`**

In `src/components/DateRangePicker.tsx`, add the import after the existing imports:

```ts
import { getPriceTint, type PriceTint } from '../lib/priceTint'
```

- [ ] **Step 2: Compute tint inside the `days.map` in the `Calendar` component**

In the `Calendar` function, inside the `days.map(day => { ... })` callback (around line 114), add the tint computation right after the existing variable declarations (`isPast`, `isStart`, `isEnd`, `inRange`, `isT`, `inCurMonth`):

```ts
const tint: PriceTint | undefined =
  !isPast && inCurMonth && !isStart && !isEnd && !inRange
    ? getPriceTint(day)
    : undefined
```

- [ ] **Step 3: Apply tint background to the inner day div**

Still inside `days.map`, the inner `<div>` currently has:

```tsx
<div style={{
    height: 34, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius, background: bg, color,
    fontSize: 13, fontWeight,
    ...(isT && !isStart && !isEnd ? { outline: '1.5px solid #2A60C2', outlineOffset: '-1px' } : {}),
    opacity: isPast || !inCurMonth ? 0.35 : 1,
    transition: 'background 0.12s',
}}>
    {format(day, 'd')}
</div>
```

Replace it with:

```tsx
<div style={{
    height: 34, width: '100%', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 2,
    borderRadius,
    background: tint === 'green' ? '#F0FDF4' : tint === 'yellow' ? '#FEFCE8' : tint === 'red' ? '#FFF1F2' : bg,
    color,
    fontSize: 13, fontWeight,
    ...(isT && !isStart && !isEnd ? { outline: '1.5px solid #2A60C2', outlineOffset: '-1px' } : {}),
    opacity: isPast || !inCurMonth ? 0.35 : 1,
    transition: 'background 0.12s',
}}>
    {format(day, 'd')}
    {tint && (
        <div style={{
            width: 4, height: 4, borderRadius: '50%',
            background: tint === 'green' ? '#4ADE80' : tint === 'yellow' ? '#FBBF24' : '#FCA5A5',
            flexShrink: 0,
        }} />
    )}
</div>
```

- [ ] **Step 4: Add the legend below the calendars in `calendarPanel`**

In `DateRangePicker.tsx`, the `calendarPanel` JSX contains a `{/* Footer hint */}` section. Add the legend **above** the footer hint:

```tsx
{/* Price tint legend */}
<div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', paddingTop: 4 }}>
    {([
        { tint: 'green',  dot: '#4ADE80', label: 'Geralmente mais barato' },
        { tint: 'yellow', dot: '#FBBF24', label: 'Preço médio' },
        { tint: 'red',    dot: '#FCA5A5', label: 'Alta demanda' },
    ] as const).map(({ tint, dot, label }) => (
        <div key={tint} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
                width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                background: tint === 'green' ? '#F0FDF4' : tint === 'yellow' ? '#FEFCE8' : '#FFF1F2',
                border: `1.5px solid ${dot}`,
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#4B5563' }}>{label}</span>
        </div>
    ))}
</div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit --skipLibCheck
```

Expected: no errors

- [ ] **Step 6: Verify visually**

```bash
npm run dev
```

Open the search form → click the date field → calendar opens. Confirm:
- Weekday dates (Mon–Thu) have a very faint green background with tiny green dot
- Fridays/Sundays have a very faint red background with tiny red dot
- Saturdays have a very faint yellow background with tiny yellow dot
- Known holiday (e.g. 25 Dec, 1 Jan) → red tint
- Selected date (navy) shows no tint, no dot
- In-range dates (light blue) show no tint, no dot
- Legend appears at the bottom of the calendar panel

- [ ] **Step 7: Commit**

```bash
git add src/components/DateRangePicker.tsx
git commit -m "feat(calendar): apply subtle price tints to DateRangePicker"
```
