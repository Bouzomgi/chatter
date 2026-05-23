# Chatter

A personal chat app modeled on iMessage.

## Features

- **Real-time messaging** — messages appear instantly via Socket.io, no page refresh needed
- **Conversation history** — full message history stored in PostgreSQL
- **User discovery** — find other users by username to start a new conversation
- **User avatars** — each account is assigned a unique avatar on registration
- **Auth** — secure login and registration with bcrypt passwords and JWT sessions (httpOnly cookies)
