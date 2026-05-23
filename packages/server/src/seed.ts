import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'
import { fileURLToPath } from 'url'

const prisma = new PrismaClient()

export async function seed() {
  await prisma.message.deleteMany()
  await prisma.participant.deleteMany()
  await prisma.conversation.deleteMany()
  await prisma.user.deleteMany()

  const hash = await bcrypt.hash('password123', 12)

  const [alice, bob, carol] = await Promise.all([
    prisma.user.create({ data: { username: 'alice', email: 'alice@example.com', passwordHash: hash, avatarIndex: 5 } }),
    prisma.user.create({ data: { username: 'bob', email: 'bob@example.com', passwordHash: hash, avatarIndex: 0 } }),
    prisma.user.create({ data: { username: 'carol', email: 'carol@example.com', passwordHash: hash, avatarIndex: 6 } }),
  ])

  // alice <-> bob
  const abConvo = await prisma.conversation.create({
    data: {
      participants: { create: [{ userId: alice.id }, { userId: bob.id }] },
    },
  })

  await prisma.message.createMany({
    data: [
      { conversationId: abConvo.id, senderId: alice.id, body: 'Hey Bob!', createdAt: new Date('2025-01-01T10:00:00Z') },
      { conversationId: abConvo.id, senderId: bob.id, body: 'Hey Alice! How are you?', createdAt: new Date('2025-01-01T10:01:00Z') },
      { conversationId: abConvo.id, senderId: alice.id, body: 'Doing great, thanks for asking!', createdAt: new Date('2025-01-01T10:02:00Z') },
      { conversationId: abConvo.id, senderId: bob.id, body: 'Glad to hear it 😊', createdAt: new Date('2025-01-01T10:03:00Z') },
    ],
  })

  // alice <-> carol
  const acConvo = await prisma.conversation.create({
    data: {
      participants: { create: [{ userId: alice.id }, { userId: carol.id }] },
    },
  })

  await prisma.message.createMany({
    data: [
      { conversationId: acConvo.id, senderId: carol.id, body: 'Alice, are we still on for Thursday?', createdAt: new Date('2025-01-02T09:00:00Z') },
      { conversationId: acConvo.id, senderId: alice.id, body: 'Yes! See you then', createdAt: new Date('2025-01-02T09:05:00Z') },
      { conversationId: acConvo.id, senderId: carol.id, body: 'Perfect 👍', createdAt: new Date('2025-01-02T09:06:00Z') },
    ],
  })
}

async function main() {
  await seed()
  console.log('Seeded database')
  await prisma.$disconnect()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
