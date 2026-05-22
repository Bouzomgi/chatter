import { seed } from '../seed.js'
import prisma from '../lib/prisma.js'

export default async function globalSetup() {
  await seed()
  await prisma.$disconnect()
}
