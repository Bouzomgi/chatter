import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login.js'
import Register from './pages/Register.js'
import Chat from './pages/Chat.js'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Chat />} />
      </Routes>
    </BrowserRouter>
  )
}
