import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64

export async function hashLocalPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const key = await scrypt(password, salt, KEY_LENGTH) as Buffer
  return `scrypt:${salt}:${key.toString('hex')}`
}

export async function verifyLocalPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, hash] = storedHash.split(':')
  if (algorithm !== 'scrypt' || !salt || !hash) return false

  const expected = Buffer.from(hash, 'hex')
  const actual = await scrypt(password, salt, expected.length) as Buffer
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
