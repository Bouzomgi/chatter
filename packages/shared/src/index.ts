export type UserId = string
export type ConversationId = string

export interface User {
  id: UserId
  username: string
  email: string
  avatarIndex: number
  createdAt: string
}

export interface Message {
  id: string
  conversationId: ConversationId
  senderId: UserId
  body: string
  createdAt: string
}
