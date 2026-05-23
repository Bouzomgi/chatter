type FormFieldProps = {
  fieldName: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  error?: string
  isPassword?: boolean
}

export default function FormField({ fieldName, value, onChange, error, isPassword }: FormFieldProps) {
  return (
    <div className="flex flex-col w-full gap-1">
      <input
        id={fieldName}
        type={isPassword ? 'password' : 'text'}
        placeholder={fieldName}
        value={value}
        onChange={onChange}
        autoComplete="off"
        className="w-full bg-[#f7f9f9] rounded-lg shadow-[0px_1.5px_1.5px_0px_grey] text-[28px] indent-4 py-1 outline-none"
      />
      <span className="text-[18px] text-red-900 min-h-[18px] indent-1">{error}</span>
    </div>
  )
}
