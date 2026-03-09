import { useEffect, useId } from 'react'
import { MotionValue, motion, useMotionValue, useTransform, animate } from 'framer-motion'
import useMeasure from 'react-use-measure'

function Number({ mv, number }: { mv: MotionValue<number>; number: number }) {
    const uniqueId = useId()
    const [ref, bounds] = useMeasure()

    const y = useTransform(mv, (latest: number) => {
        if (!bounds.height) return 0
        const placeValue = latest % 10
        const offset = (10 + number - placeValue) % 10
        let memo = offset * bounds.height
        if (offset > 5) memo -= 10 * bounds.height
        return memo
    })

    if (!bounds.height) {
        return (
            <span ref={ref} style={{ visibility: 'hidden', position: 'absolute' }}>
                {number}
            </span>
        )
    }

    return (
        <motion.span
            ref={ref}
            style={{ y, position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            layoutId={`${uniqueId}-${number}`}
        >
            {number}
        </motion.span>
    )
}

function Digit({ value, place }: { value: number; place: number }) {
    const valueRoundedToPlace = Math.floor(value / place) % 10
    const mv = useMotionValue(valueRoundedToPlace)

    useEffect(() => {
        animate(mv, valueRoundedToPlace, { duration: 2.5, ease: 'easeOut' })
    }, [mv, valueRoundedToPlace])

    return (
        <div style={{
            position: 'relative',
            display: 'inline-block',
            width: '0.6em',
            overflow: 'hidden',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
        }}>
            <div style={{ visibility: 'hidden' }}>0</div>
            {Array.from({ length: 10 }, (_, i) => (
                <Number key={i} mv={mv} number={i} />
            ))}
        </div>
    )
}

interface SlidingNumberProps {
    value: number
    padStart?: boolean
}

export function SlidingNumber({ value, padStart = false }: SlidingNumberProps) {
    const absValue = Math.abs(value)
    const integerPart = absValue.toString()
    const integerValue = parseInt(integerPart, 10)
    const paddedInteger = padStart && integerValue < 10 ? `0${integerPart}` : integerPart
    const integerDigits = paddedInteger.split('')
    const integerPlaces = integerDigits.map((_, i) =>
        Math.pow(10, integerDigits.length - i - 1)
    )

    return (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            {value < 0 && '-'}
            {integerDigits.map((_, index) => (
                <Digit
                    key={`pos-${integerPlaces[index]}`}
                    value={integerValue}
                    place={integerPlaces[index]}
                />
            ))}
        </span>
    )
}
