import { scrypt as _scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(_scrypt);

export async function isExistedPassword(password: string): Promise<boolean> {
  const [salt, storedHash] = password.split(';');

  const hash = (await scrypt(password, salt, 32)) as Buffer;
  if (storedHash !== hash.toString('hex')) {
    return false;
  }

  return true;
}

export async function isHashingPassword(password: string): Promise<string> {
  const salt = randomBytes(8).toString('hex');

  const hash = (await scrypt(password, salt, 32)) as Buffer;

  const result = salt + ';' + hash.toString('hex');

  return result;
}
