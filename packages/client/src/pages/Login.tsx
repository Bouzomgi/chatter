import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth.js'
import FormField from '../components/FormField.js'
import SubmissionArrow from '../components/SubmissionArrow.js'

export default function Login() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [isShaking, setIsShaking] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.id]: e.target.value }))
  }

  function shake() {
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 500)
  }

  async function submit() {
    setError('')
    if (!form.email || !form.password) {
      setError('All fields are required')
      shake()
      return
    }
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error ?? 'Invalid credentials')
        shake()
        return
      }
      setUser(await res.json())
      navigate('/')
    } catch {
      setError('Could not connect to server')
      shake()
    }
  }

  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="bg-[#e0d0c180] rounded-3xl w-[30%] flex flex-col justify-between gap-4 px-[3%] py-[2%]">
        <h1 className="text-[50px] font-normal text-center m-0">login</h1>
        <div className="flex flex-col gap-4">
          <FormField fieldName="email" value={form.email} onChange={handleChange} />
          <FormField fieldName="password" value={form.password} onChange={handleChange} isPassword />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-center text-[24px] h-[32px] overflow-hidden">
            <span className="text-red-900">{error}</span>
          </div>
          <div className="flex justify-between items-center">
            <Link to="/register" className="text-[22px] ml-[10%] hover:drop-shadow-[1px_1px_1px_#00a676] cursor-pointer no-underline text-inherit">
              register?
            </Link>
            <SubmissionArrow onSubmit={submit} isShaking={isShaking} />
          </div>
        </div>
      </div>
    </div>
  )
}
