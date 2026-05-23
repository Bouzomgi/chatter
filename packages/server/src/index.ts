import { createApp } from './app.js'
import { provisionAdmin } from './lib/adminProvisioner.js'

const { httpServer } = createApp()
const port = process.env.PORT ?? 3000

await provisionAdmin()

httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
