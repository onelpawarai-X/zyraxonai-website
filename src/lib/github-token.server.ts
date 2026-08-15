const encoder = new TextEncoder();

function keyBytes(): Uint8Array {
  const value = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY is not configured');
  const bytes = Uint8Array.from(Buffer.from(value, 'base64'));
  if (bytes.length !== 32) throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY must decode to 32 bytes');
  return bytes;
}

export async function encryptGitHubToken(token: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', keyBytes(), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(token)));
  return `${Buffer.from(iv).toString('base64url')}.${Buffer.from(ciphertext).toString('base64url')}`;
}

export async function decryptGitHubToken(value: string): Promise<string> {
  const [ivPart, ciphertextPart] = value.split('.');
  if (!ivPart || !ciphertextPart) throw new Error('Invalid encrypted GitHub token');
  const key = await crypto.subtle.importKey('raw', keyBytes(), 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Uint8Array.from(Buffer.from(ivPart, 'base64url')) },
    key,
    Uint8Array.from(Buffer.from(ciphertextPart, 'base64url')),
  );
  return new TextDecoder().decode(plaintext);
}
