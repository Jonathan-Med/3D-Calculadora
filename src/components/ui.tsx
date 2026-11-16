import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'

const control =
  'h-10 w-full min-w-0 rounded-lg border border-line bg-surface text-base text-ink outline-none ' +
  'focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25'

export function Card({
  title,
  description,
  action,
  children,
}: {
  title?: string
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      {title && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:opacity-90',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-muted hover:bg-surface-2 hover:text-ink',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={
        'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium ' +
        'outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50 ' +
        `${buttonVariants[variant]} ${className}`
      }
      {...props}
    />
  )
}

export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <Button variant="ghost" aria-label={label} title={label} className="w-10 px-0" {...props}>
      {children}
    </Button>
  )
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: ReactNode
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  )
}

const toNumber = (text: string): number => {
  const parsed = Number.parseFloat(text.replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const toText = (value: number): string => (Number.isFinite(value) && value > 0 ? String(value) : '')

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  id?: string
  prefix?: string
  suffix?: string
  integer?: boolean
  'aria-label'?: string
}

/**
 * Campo numérico que acepta estar vacío. Mientras tiene el foco muestra lo que
 * se teclea; fuera de foco muestra el valor guardado, que puede llegar con retraso
 * cuando viene de la base de datos.
 */
export function NumberInput({
  value,
  onChange,
  id,
  prefix,
  suffix,
  integer = false,
  'aria-label': ariaLabel,
}: NumberInputProps) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState('')
  const pattern = integer ? /^\d*$/ : /^\d*[.,]?\d*$/

  return (
    <div className={`flex items-center ${control}`}>
      {prefix && <span className="pl-3 text-muted">{prefix}</span>}
      <input
        id={id}
        aria-label={ariaLabel}
        inputMode={integer ? 'numeric' : 'decimal'}
        autoComplete="off"
        placeholder="0"
        className="h-full w-full min-w-0 bg-transparent px-3 tabular-nums outline-none placeholder:text-muted/60"
        value={focused ? text : toText(value)}
        onFocus={(event) => {
          setText(toText(value))
          setFocused(true)
          event.target.select()
        }}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          const next = event.target.value
          if (!pattern.test(next)) return
          setText(next)
          onChange(toNumber(next))
        }}
      />
      {suffix && <span className="shrink-0 pr-3 text-sm text-muted">{suffix}</span>}
    </div>
  )
}

export function NumberField({
  label,
  hint,
  ...input
}: Omit<NumberInputProps, 'id' | 'aria-label'> & { label: string; hint?: ReactNode }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <NumberInput id={id} {...input} />
    </Field>
  )
}

interface TextInputProps {
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  'aria-label'?: string
}

/** Igual que NumberInput: lo tecleado manda mientras el campo tiene el foco. */
export function TextInput({ value, onChange, id, placeholder, 'aria-label': ariaLabel }: TextInputProps) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState('')

  return (
    <input
      id={id}
      aria-label={ariaLabel}
      placeholder={placeholder}
      autoComplete="off"
      className={`${control} px-3 placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/25`}
      value={focused ? text : value}
      onFocus={() => {
        setText(value)
        setFocused(true)
      }}
      onBlur={() => setFocused(false)}
      onChange={(event) => {
        setText(event.target.value)
        onChange(event.target.value)
      }}
    />
  )
}

export function TextField({
  label,
  hint,
  ...input
}: Omit<TextInputProps, 'id' | 'aria-label'> & { label: string; hint?: ReactNode }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <TextInput id={id} {...input} />
    </Field>
  )
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${control} px-2 focus:border-accent focus:ring-2 focus:ring-accent/25 ${className}`}
      {...props}
    />
  )
}

/** Etiqueta pequeña encima de un control dentro de una fila compacta. */
export function MiniLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-xs text-muted">{children}</span>
}
