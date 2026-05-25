import { createApp } from './app.js'
import { provisionAdmin } from './lib/adminProvisioner.js'
import logger from './lib/logger.js'

const jwtSecret = process.env.JWT_SECRET ?? ''
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters')
}

const { httpServer } = createApp()
const port = process.env.PORT ?? 3000

await provisionAdmin()

httpServer.listen(port, () => {
  logger.info({ port }, 'Server listening')
})
