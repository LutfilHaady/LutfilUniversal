import { STEPS } from '../data/steps'

export default function Stepper({ currentIndex }) {
  return (
    <ol className="stepper" aria-label="Production steps">
      {STEPS.map((label, i) => {
        const state =
          i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo'
        return (
          <li key={label} className={`stepper-step stepper-${state}`}>
            <span className="stepper-index">{i + 1}</span>
            <span className="stepper-label">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
