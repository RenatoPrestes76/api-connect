/**
 * Strips connection-string-shaped credentials (`scheme://user:pass@host`)
 * out of free-text error messages before they're persisted to audit
 * metadata or health-check history — a Runtime-reported error string could
 * otherwise leak a raw password verbatim.
 *
 * This module used to also hold `encryptCredential`/`decryptCredential`
 * for the connection profile's own password field. Sprint A2.6 removed
 * that field entirely — the cloud never stores an ERP credential, in any
 * form, encrypted or not (see docs/ATLAS-RUNTIME-CLIENT.md's "ERP
 * credentials never leave the client machine"). This function is
 * unrelated to that removal: it's about not leaking a credential that
 * happens to appear *inside error text the Runtime sends*, not about
 * storing one.
 */
export function maskSecretsInText(text: string): string {
  return text.replace(/:\/\/[^/@\s]+:[^/@\s]+@/g, '://***:***@');
}
