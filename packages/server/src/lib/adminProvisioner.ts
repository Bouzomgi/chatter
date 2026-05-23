import bcrypt from 'bcrypt'
import prisma from './prisma.js'

export async function provisionAdmin() {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  const email = process.env.ADMIN_EMAIL ?? `${username}@admin.local`

  if (!username || !password) {
    console.log('ADMIN_USERNAME/ADMIN_PASSWORD not set — skipping admin provisioning')
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.upsert({
    where: { username },
    update: { passwordHash, email },
    create: { username, email, passwordHash, avatarIndex: 0 },
  })

  console.log(`Admin user '${username}' provisioned`)
}
