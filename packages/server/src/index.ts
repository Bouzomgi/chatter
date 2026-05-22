import { createApp } from './app.js'

const { httpServer } = createApp()
const port = process.env.PORT ?? 3000
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
