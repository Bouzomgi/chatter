import bcrypt from 'bcrypt'
import prisma from './prisma.js'

export async function provisionAdmin() {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD

  if (!username || !password) {
    console.log('ADMIN_USERNAME/ADMIN_PASSWORD not set — skipping admin provisioning')
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, email: `${username}@admin.local`, passwordHash, avatarIndex: 0 },
  })

  console.log(`Admin user '${username}' provisioned`)
}
