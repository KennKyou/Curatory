import { describe, it, expect, beforeAll } from 'vitest'
import { createTestUser } from '~/tests/helpers'
import { User } from '~/server/models/User'

describe('User model', () => {
  beforeAll(async () => {
    await User.syncIndexes()
  })

  it('creates a user with default values', async () => {
    const user = await createTestUser()

    expect(user._id).toBeDefined()
    expect(user.name).toBe('Test User')
    expect(user.avatar).toBe('')
    expect(user.passwordHash).toBeTruthy()
    expect(user.createdAt).toBeInstanceOf(Date)
    expect(user.updatedAt).toBeInstanceOf(Date)
  })

  it('creates a user with overrides', async () => {
    const user = await createTestUser({ name: 'Custom Name', avatar: 'https://example.com/avatar.jpg' })

    expect(user.name).toBe('Custom Name')
    expect(user.avatar).toBe('https://example.com/avatar.jpg')
  })

  it('requires email', async () => {
    await expect(User.create({ passwordHash: 'hash', name: 'Test' })).rejects.toThrow()
  })

  it('requires passwordHash', async () => {
    await expect(User.create({ email: 'a@b.com', name: 'Test' })).rejects.toThrow()
  })

  it('requires name', async () => {
    await expect(User.create({ email: 'a@b.com', passwordHash: 'hash' })).rejects.toThrow()
  })

  it('enforces unique email', async () => {
    await createTestUser({ email: 'dup@test.com' })
    await expect(createTestUser({ email: 'dup@test.com' })).rejects.toThrow()
  })
})
