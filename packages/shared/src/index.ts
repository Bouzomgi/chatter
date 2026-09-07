export type UserId = string
export type ConversationId = string

export interface User {
  id: UserId
  username: string
  email: string
  avatarIndex: number
  createdAt: string
}

export interface UserSummary {
  id: UserId
  username: string
  avatarIndex: number
}

export interface Message {
  id: string
  conversationId: ConversationId
  senderId: UserId
  body: string
  createdAt: string
}

export interface Conversation {
  id: ConversationId
  createdAt: string
  participants: UserSummary[]
  latestMessage: { body: string; senderId: UserId; createdAt: string } | null
  unread: boolean
}
