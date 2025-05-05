import { scrypt as _scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(_scrypt);

export async function isPasswordMatching(
  userInputPassword: string,
  storedPasswordWithSalt: string,
): Promise<boolean> {
  const [salt, storedPasswordHash] = storedPasswordWithSalt.split(';');

  const derivedPasswordHash = (await scrypt(
    userInputPassword,
    salt,
    32,
  )) as Buffer;
  if (storedPasswordHash !== derivedPasswordHash.toString('hex')) {
    return false;
  }

  return true;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(8).toString('hex');

  const hash = (await scrypt(password, salt, 32)) as Buffer;

  const hashedPassword = salt + ';' + hash.toString('hex');

  return hashedPassword;
}
