import { getRandomBytes } from './crypto';

/**
 * Gets encryption key for realm.
 * - Checks keychain if there is already an encryption key stored for realm data.
 * - Returns encryption key stored in keychain (if exists).
 * - Otherwise generates a new one and stores it in keychain.
 *
 * @method getEncryptionKey
 * @returns {Promise}
 */
export const getEncryptionKey = () => {
    return getRandomBytes(64);
};
