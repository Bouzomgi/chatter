import { createApp } from './app.js'
import { provisionAdmin } from './lib/adminProvisioner.js'
import logger from './lib/logger.js'

const { httpServer } = createApp()
const port = process.env.PORT ?? 3000

await provisionAdmin()

httpServer.listen(port, () => {
  logger.info({ port }, 'Server listening')
})
