import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    env: {
      JWT_SECRET: 'test-secret-do-not-use-in-real-life-0123456789',
      USERS_TABLE: 'UsersTableTest',
      USERS_BY_EMAIL_TABLE: 'UsersByEmailTableTest',
      USERS_BY_USERNAME_TABLE: 'UsersByUsernameTableTest',
      PARTICIPANTS_TABLE: 'ParticipantsTableTest',
      CONNECTIONS_TABLE: 'ConnectionsTableTest',
      CONNECTION_USERS_TABLE: 'ConnectionUsersTableTest',
    },
  },
})
