import crypto from 'crypto';

export const DEV_FALLBACK_PII_KEY = 'unikorn360_default_dev_pii_encryption_key_2026_aes256';

const INSECURE_PLACEHOLDER_KEYS = new Set([
  DEV_FALLBACK_PII_KEY,
  'changeme',
  'default',
  'secret',
  'password',
  'your-encryption-key-here',
]);

/**
 * Formal inventory of Personally Identifiable Information (PII)
 * across parties, witnesses, narrative fields, OCR output, generated content, and logs.
 */
export const PII_INVENTORY = {
  parties: ['aadhaar', 'pan', 'phone', 'mobile', 'email', 'bankDetails', 'accountNo'],
  witnesses: ['aadhaar', 'phone', 'mobile', 'idProof', 'address'],
  narrativeFields: [
    'ownershipHistory.parentDocNo',
    'ownershipHistory.previousOwners',
    'ownershipHistory.notes',
    'property.scheduleDescription',
    'boundary.north',
    'boundary.south',
    'boundary.east',
    'boundary.west',
    'notes'
  ],
  ocrOutput: [
    'extractedData.seller.aadhaar',
    'extractedData.seller.pan',
    'extractedData.seller.phone',
    'extractedData.buyer.aadhaar',
    'extractedData.buyer.pan',
    'extractedData.buyer.phone'
  ],
  generatedContent: [
    'compiledSections.contentEn (party descriptions, witness schedules)',
    'compiledSections.contentTa (தரப்பினர் விவரம், சாட்சிகள் அட்டவணை)',
    'exportedPdf (rendered canvas text)',
    'exportedDocx (formatted TextRun paragraphs)'
  ],
  logs: [
    'auditLog.details',
    'serverHttpLogs',
    'errorLogs'
  ]
} as const;

/**
 * Validates and derives the 32-byte AES-256-GCM PII encryption key.
 * In production (NODE_ENV === 'production'), requires a strong explicitly configured
 * PII_ENCRYPTION_KEY (>= 32 chars) and rejects the development fallback key.
 */
export function resolvePiiEncryptionKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const isProd = env.NODE_ENV === 'production';
  const configuredKey = (env.PII_ENCRYPTION_KEY || '').trim();

  if (isProd) {
    if (!configuredKey) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: PII_ENCRYPTION_KEY is required in production and cannot be empty.'
      );
    }
    if (configuredKey.length < 32 || INSECURE_PLACEHOLDER_KEYS.has(configuredKey.toLowerCase()) || configuredKey === DEV_FALLBACK_PII_KEY) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: PII_ENCRYPTION_KEY in production must be at least 32 characters long and must not use a default or placeholder key.'
      );
    }
  }

  const effectiveRawKey = configuredKey || DEV_FALLBACK_PII_KEY;
  return crypto.createHash('sha256').update(effectiveRawKey).digest();
}

// Validate immediately on module load if running in production
if (process.env.NODE_ENV === 'production') {
  resolvePiiEncryptionKey(process.env);
}

/**
 * Strictly verifies whether a value is genuine AES-256-GCM ciphertext.
 * DO NOT accept a value merely because it starts with "v1:".
 * Validates:
 * 1. Must start with "v1:".
 * 2. Exactly 4 colon-delimited components: v1, ivHex (24 hex chars), authTagHex (32 hex chars), ciphertextHex (even length hex).
 * 3. Cryptographically decrypts cleanly with the derived key and authenticates via GCM auth tag.
 */
export function isValidCiphertext(val: unknown, env: NodeJS.ProcessEnv = process.env): boolean {
  if (typeof val !== 'string' || !val) return false;
  if (!val.startsWith('v1:')) return false;

  const parts = val.split(':');
  if (parts.length !== 4) return false;

  const [, ivHex, authTagHex, ciphertextHex] = parts;

  // 12-byte IV in hex is exactly 24 hex characters
  if (!/^[0-9a-fA-F]{24}$/.test(ivHex)) return false;

  // 16-byte GCM authentication tag in hex is exactly 32 hex characters
  if (!/^[0-9a-fA-F]{32}$/.test(authTagHex)) return false;

  // Ciphertext must be non-empty hex of even length
  if (!/^[0-9a-fA-F]+$/.test(ciphertextHex) || ciphertextHex.length % 2 !== 0) return false;

  try {
    const key = resolvePiiEncryptionKey(env);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return typeof decrypted.toString('utf8') === 'string';
  } catch {
    return false;
  }
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Rejects values that merely start with "v1:" without passing cryptographic validity.
 */
export function encryptGCM(plaintext: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!plaintext) return '';

  // DO NOT accept merely starting with v1: — verify it is strictly valid ciphertext
  if (isValidCiphertext(plaintext, env)) {
    return plaintext; // genuinely already encrypted with current key
  }

  const key = resolvePiiEncryptionKey(env);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptGCM(encryptedString: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!encryptedString) return '';
  if (!encryptedString.startsWith('v1:')) {
    return encryptedString; // Return legacy plaintext as-is
  }

  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 4) {
      return '[DECRYPTION_ERROR]';
    }

    const [, ivHex, authTagHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const key = resolvePiiEncryptionKey(env);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Decryption failed, returning masked error marker:', err);
    return '[DECRYPTION_ERROR]';
  }
}

export function getDeterministicHash(value: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!value) return '';
  const plaintext = isValidCiphertext(value, env) ? decryptGCM(value, env) : value;
  if (plaintext === '[DECRYPTION_ERROR]') return '';
  const normalized = plaintext.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!normalized) return '';
  const key = resolvePiiEncryptionKey(env);
  return crypto.createHmac('sha256', key).update(normalized).digest('hex');
}

export function maskAadhaar(val: string): string {
  if (!val) return '';
  const clean = val.replace(/[^0-9]/g, '');
  if (clean.length < 4) {
    return 'XXXXXXXX' + clean;
  }
  return 'XXXXXXXX' + clean.slice(-4);
}

export function maskPAN(val: string): string {
  if (!val) return '';
  const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length < 10) {
    if (clean.length <= 5) return 'XXXXX' + clean;
    return 'XXXXX' + clean.slice(5);
  }
  return 'XXXXX' + clean.slice(5, 9) + clean.slice(-1);
}

export function maskPhone(val: string): string {
  if (!val) return '';
  const clean = val.replace(/[^0-9]/g, '');
  if (clean.length <= 4) return 'XXXXXX' + clean;
  return 'XXXXXX' + clean.slice(-4);
}

export function maskEmail(val: string): string {
  if (!val || typeof val !== 'string') return '';
  const [user, domain] = val.split('@');
  if (!domain) return '***@***';
  const maskedUser = user.length <= 2 ? user[0] + '***' : user[0] + '***' + user.slice(-1);
  return `${maskedUser}@${domain}`;
}

/**
 * Detects whether a string is a masked value produced by role disclosure rules
 * (e.g. XXXXXXXX1234, XXXX-XXXX-1234, XXXXX1234F, XXXXXX2233, etc.).
 */
export function isMaskedValue(val: unknown): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();

  // Masked Aadhaar: 8 Xs or bullets followed by 4 digits
  if (/^(?:X{8}|[•*]{8})\d{4}$/i.test(trimmed.replace(/[\s-]/g, ''))) return true;
  if (/^(?:X{4}|[•*]{4})[-\s]?(?:X{4}|[•*]{4})[-\s]?\d{4}$/i.test(trimmed)) return true;

  // Masked PAN: 5 Xs or bullets followed by 4 digits and 1 char
  if (/^(?:X{5}|[•*]{5})\d{4}[A-Za-z]$/i.test(trimmed)) return true;

  // Masked Phone: 6 Xs or bullets followed by 4 digits
  if (/^(?:X{6}|[•*]{6})\d{4}$/i.test(trimmed.replace(/[\s-]/g, ''))) return true;

  // Generic full mask
  if (/^X{4,}$/i.test(trimmed) || /^[•*]{4,}$/.test(trimmed)) return true;

  return false;
}

/**
 * Prevents masked response values in client updates from overwriting protected original values.
 * If incoming candidate client has masked PAN/Aadhaar/Phone, preserves existing unmasked original values.
 */
export function preserveClientProtectedValues(candidateClient: any, existingClient: any): any {
  if (!candidateClient || typeof candidateClient !== 'object') return candidateClient;
  if (!existingClient || typeof existingClient !== 'object') return candidateClient;

  const result = { ...candidateClient };

  // PAN
  if (isMaskedValue(result.pan) && existingClient.pan && !isMaskedValue(existingClient.pan)) {
    result.pan = existingClient.pan;
    result.panHash = existingClient.panHash || existingClient.pan_hash;
    result.pan_hash = result.panHash;
  }

  // Aadhaar
  if (isMaskedValue(result.aadhaar) && existingClient.aadhaar && !isMaskedValue(existingClient.aadhaar)) {
    result.aadhaar = existingClient.aadhaar;
    result.aadhaarHash = existingClient.aadhaarHash || existingClient.aadhaar_hash;
    result.aadhaar_hash = result.aadhaarHash;
  }

  // Phone
  if (isMaskedValue(result.phone) && existingClient.phone && !isMaskedValue(existingClient.phone)) {
    result.phone = existingClient.phone;
  }

  return result;
}

/**
 * Prevents masked response values in document updates from overwriting protected original values in state.
 * Scans parties and witnesses and preserves unmasked values from existing document if candidate contains masks.
 */
export function preserveProtectedValuesOnSave(candidateState: any, existingState: any): any {
  if (!candidateState || typeof candidateState !== 'object') return candidateState;
  if (!existingState || typeof existingState !== 'object') return candidateState;

  const result = JSON.parse(JSON.stringify(candidateState));

  // 1. Parties
  if (Array.isArray(result.parties) && Array.isArray(existingState.parties)) {
    result.parties = result.parties.map((candParty: any, idx: number) => {
      if (!candParty || typeof candParty !== 'object') return candParty;

      // Find matching existing party by id, or fallback to index
      const existingParty =
        existingState.parties.find((ep: any) => ep && ep.id && ep.id === candParty.id) ||
        existingState.parties[idx];

      if (!existingParty || typeof existingParty !== 'object') return candParty;

      const updated = { ...candParty };

      // Aadhaar
      if (isMaskedValue(updated.aadhaar) && existingParty.aadhaar && !isMaskedValue(existingParty.aadhaar)) {
        updated.aadhaar = existingParty.aadhaar;
      }

      // PAN
      if (isMaskedValue(updated.pan) && existingParty.pan && !isMaskedValue(existingParty.pan)) {
        updated.pan = existingParty.pan;
      }

      // Phone
      if (isMaskedValue(updated.phone) && existingParty.phone && !isMaskedValue(existingParty.phone)) {
        updated.phone = existingParty.phone;
      }

      return updated;
    });
  }

  // 2. Witnesses
  if (Array.isArray(result.witnesses) && Array.isArray(existingState.witnesses)) {
    result.witnesses = result.witnesses.map((candWitness: any, idx: number) => {
      if (!candWitness || typeof candWitness !== 'object') return candWitness;

      const existingWitness =
        existingState.witnesses.find((ew: any) => ew && ew.id && ew.id === candWitness.id) ||
        existingState.witnesses[idx];

      if (!existingWitness || typeof existingWitness !== 'object') return candWitness;

      const updated = { ...candWitness };

      if (isMaskedValue(updated.aadhaar) && existingWitness.aadhaar && !isMaskedValue(existingWitness.aadhaar)) {
        updated.aadhaar = existingWitness.aadhaar;
      }

      if (isMaskedValue(updated.phone) && existingWitness.phone && !isMaskedValue(existingWitness.phone)) {
        updated.phone = existingWitness.phone;
      }

      return updated;
    });
  }

  return result;
}

export function maskPIIInText(text: string): string {
  if (!text) return '';

  let result = text.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, (match) => {
    const digitsOnly = match.replace(/[^0-9]/g, '');
    return 'XXXXXXXX' + digitsOnly.slice(-4);
  });

  result = result.replace(/\b[A-Za-z]{5}[0-9]{4}[A-Za-z]\b/g, (match) => {
    const upper = match.toUpperCase();
    return 'XXXXX' + upper.slice(5, 9) + upper.slice(-1);
  });

  // Mask 10-digit Indian phone numbers
  result = result.replace(/\b(?:[6-9]\d{9})\b/g, (match) => {
    return 'XXXXXX' + match.slice(-4);
  });

  // Mask email addresses
  result = result.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, (match) => {
    return maskEmail(match);
  });

  return result;
}

export interface UserContext {
  role: string;
  email: string;
  id?: string;
  phone?: string;
  elevatedReview?: boolean;
  reasonCode?: string;
}

export function serializeClient(client: any, user: UserContext): any {
  if (!client) return null;
  const { panHash, aadhaarHash, pan_hash, aadhaar_hash, ...serialized } = client;

  let shouldMask = true;
  const role = user.role;
  const isElevated = !!user.elevatedReview;

  if (role === 'Super Admin') {
    shouldMask = false;
  } else if (role === 'Admin') {
    shouldMask = !isElevated;
  } else if (role === 'Auditor') {
    shouldMask = !isElevated;
  } else if (role === 'Client') {
    const isOwn =
      (user.id && client.id === user.id) ||
      (user.id && client.createdByUserId === user.id) ||
      (user.email && client.email?.toLowerCase() === user.email.toLowerCase());
    if (isOwn) {
      shouldMask = false;
    }
  }

  if (shouldMask) {
    serialized.pan = maskPAN(client.pan);
    serialized.aadhaar = maskAadhaar(client.aadhaar);
    if (serialized.phone) {
      serialized.phone = maskPhone(client.phone);
    }
  }

  return serialized;
}

/**
 * Serializes a document for API responses, applying role-appropriate disclosure consistently across:
 * 1. Parties (Aadhaar, PAN, Phone)
 * 2. Witnesses (Aadhaar, Phone, ID Proof)
 * 3. Narrative fields (ownershipHistory.notes, scheduleDescription)
 */
export function serializeDocument(doc: any, user: UserContext): any {
  if (!doc) return null;
  const serialized = JSON.parse(JSON.stringify(doc));

  const normalizedRole = (user.role || '').trim().toLowerCase();
  const isElevated = !!user.elevatedReview;
  const isDocCreator = Boolean(
    user.id && (doc.createdByUserId === user.id || doc.state?.createdByUserId === user.id)
  );

  let globalMask = true;
  if (normalizedRole === 'super admin' || normalizedRole === 'superadmin') {
    globalMask = false;
  } else if (normalizedRole === 'admin' || normalizedRole === 'auditor') {
    globalMask = !isElevated;
  } else if (
    normalizedRole === 'document writer' ||
    normalizedRole === 'lawyer' ||
    normalizedRole === 'data entry operator' ||
    normalizedRole === 'writer'
  ) {
    // Creator/assigned writer drafting their own document can see raw party details
    if (isDocCreator) {
      globalMask = false;
    }
  }

  if (serialized.state && typeof serialized.state === 'object') {
    // 1. Parties
    if (Array.isArray(serialized.state.parties)) {
      serialized.state.parties = serialized.state.parties.map((p: any) => {
        let shouldMaskParty = globalMask;

        if (normalizedRole === 'client') {
          // Client only sees unmasked PII for their own party record
          const isOwnParty =
            (user.id && (p.userId === user.id || p.clientId === user.id)) ||
            (user.email && p.email?.toLowerCase() === user.email.toLowerCase()) ||
            (user.phone && p.phone === user.phone);
          shouldMaskParty = !isOwnParty;
        }

        if (shouldMaskParty) {
          if (p.pan) p.pan = maskPAN(p.pan);
          if (p.aadhaar) p.aadhaar = maskAadhaar(p.aadhaar);
          if (p.phone) p.phone = maskPhone(p.phone);
        }
        return p;
      });
    }

    // 2. Witnesses
    if (Array.isArray(serialized.state.witnesses)) {
      serialized.state.witnesses = serialized.state.witnesses.map((w: any) => {
        if (globalMask) {
          if (w.aadhaar) w.aadhaar = maskAadhaar(w.aadhaar);
          if (w.phone) w.phone = maskPhone(w.phone);
          if (w.idProof) w.idProof = maskPIIInText(w.idProof);
        }
        return w;
      });
    }

    // 3. Narrative fields (apply maskPIIInText if masked view)
    if (globalMask) {
      if (serialized.state.ownershipHistory?.notes) {
        serialized.state.ownershipHistory.notes = maskPIIInText(serialized.state.ownershipHistory.notes);
      }
      if (serialized.state.ownershipHistory?.historyNarrative) {
        serialized.state.ownershipHistory.historyNarrative = maskPIIInText(serialized.state.ownershipHistory.historyNarrative);
      }
      if (serialized.state.ownershipHistory?.priorOwners) {
        serialized.state.ownershipHistory.priorOwners = maskPIIInText(serialized.state.ownershipHistory.priorOwners);
      }
      if (serialized.state.property?.scheduleDescription) {
        serialized.state.property.scheduleDescription = maskPIIInText(serialized.state.property.scheduleDescription);
      }
      if (serialized.state.boundary) {
        ['north', 'south', 'east', 'west'].forEach((dir) => {
          if (serialized.state.boundary[dir]) {
            serialized.state.boundary[dir] = maskPIIInText(serialized.state.boundary[dir]);
          }
        });
      }
    }
  }

  return serialized;
}

/**
 * Sanitizes OCR extraction output according to role-appropriate disclosure.
 */
export function serializeOcrData(ocrData: any, user: UserContext): any {
  if (!ocrData || typeof ocrData !== 'object') return ocrData;
  const cloned = JSON.parse(JSON.stringify(ocrData));

  const normalizedRole = (user.role || '').trim().toLowerCase();
  let shouldMask = true;
  if (normalizedRole === 'super admin' || normalizedRole === 'superadmin' || user.elevatedReview) {
    shouldMask = false;
  }

  if (shouldMask) {
    if (cloned.extractedData) {
      const ext = cloned.extractedData;
      ['seller', 'buyer'].forEach((key) => {
        if (ext[key]) {
          if (ext[key].aadhaar) ext[key].aadhaar = maskAadhaar(ext[key].aadhaar);
          if (ext[key].pan) ext[key].pan = maskPAN(ext[key].pan);
          if (ext[key].phone) ext[key].phone = maskPhone(ext[key].phone);
        }
      });
    }
    if (Array.isArray(cloned.parties)) {
      cloned.parties = cloned.parties.map((p: any) => {
        if (p.aadhaar) p.aadhaar = maskAadhaar(p.aadhaar);
        if (p.pan) p.pan = maskPAN(p.pan);
        if (p.phone) p.phone = maskPhone(p.phone);
        return p;
      });
    }
    if (typeof cloned.rawText === 'string') {
      cloned.rawText = maskPIIInText(cloned.rawText);
    }
    if (typeof cloned.rawOcrText === 'string') {
      cloned.rawOcrText = maskPIIInText(cloned.rawOcrText);
    }
  }

  return cloned;
}
