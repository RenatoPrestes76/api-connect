/**
 * @seltriva/ai-core/erp-recognition
 * ERP Recognition — AI-powered identification of ERP systems and modules
 *
 * The ERPSpecialistAgent uses this module to identify:
 *   - Which ERP system produced the schema (SAP B1, TOTVS Protheus, Oracle, etc.)
 *   - Which module the entities belong to (MM, FI, SD, etc.)
 *   - Naming conventions specific to the identified ERP
 *   - Version-specific schema characteristics
 *
 * Recognition works from structural metadata only:
 *   - Table/entity names
 *   - Field names and types
 *   - Naming patterns and prefixes/suffixes
 *   - Known structural signatures
 */

import type { AIResult, AgentId } from '../providers/index';
import type { AIRecommendation } from '../recommendations/index';

// ─── ERP Recognition Engine ───────────────────────────────────────────────

export interface ERPRecognitionEngine {
  /**
   * Identify the ERP system from schema metadata
   */
  identify(input: ERPRecognitionInput): Promise<AIResult<ERPRecognitionResult>>;

  /**
   * Identify the ERP module within a known ERP
   */
  identifyModule(
    input: ERPModuleIdentificationInput
  ): Promise<AIResult<ERPModuleIdentificationResult>>;

  /**
   * Analyze naming conventions for a recognized ERP
   */
  analyzeConventions(input: ERPConventionAnalysisInput): Promise<AIResult<ERPConventionAnalysis>>;

  /**
   * Register a known ERP fingerprint for faster recognition
   */
  registerFingerprint(fingerprint: ERPFingerprint): void;

  /**
   * Get the recognition confidence for a specific ERP profile
   */
  scoreProfile(profileId: string, input: ERPRecognitionInput): number;
}

// ─── ERP Recognition Input ────────────────────────────────────────────────

export interface ERPRecognitionInput {
  readonly schemaName: string;
  readonly entityNames: string[];
  readonly sampleFieldNames: string[];
  readonly sampleFieldTypes?: string[];
  readonly knownVendorHints?: string[];
  readonly versionHints?: string[];
  readonly connectorMetadata?: Record<string, unknown>;
}

// ─── ERP Recognition Result ───────────────────────────────────────────────

export interface ERPRecognitionResult {
  readonly recognized: boolean;
  readonly primaryCandidate?: ERPCandidate;
  readonly alternatives: ERPCandidate[];
  readonly confidence: number;
  readonly identifyingSignals: ERPIdentifyingSignal[];
  readonly recommendation: AIRecommendation;
  readonly summary: string;
}

export interface ERPCandidate {
  readonly profileId: string;
  readonly erpName: string;
  readonly vendor: string;
  readonly productLine?: string;
  readonly confidence: number;
  readonly matchedSignals: string[];
  readonly version?: string;
  readonly modules?: string[];
}

export interface ERPIdentifyingSignal {
  readonly signalType: ERPSignalType;
  readonly value: string;
  readonly weight: number;
  readonly matchedProfile?: string;
}

export type ERPSignalType =
  | 'entity-name-pattern'
  | 'field-name-pattern'
  | 'prefix-pattern'
  | 'suffix-pattern'
  | 'naming-convention'
  | 'structural-signature'
  | 'field-type-pattern'
  | 'module-indicator'
  | 'version-indicator'
  | 'namespace-pattern';

// ─── Module Identification ────────────────────────────────────────────────

export interface ERPModuleIdentificationInput {
  readonly erpProfileId: string;
  readonly entityNames: string[];
  readonly fieldNames: string[];
}

export interface ERPModuleIdentificationResult {
  readonly erpProfileId: string;
  readonly modules: ERPModuleCandidate[];
  readonly primaryModule?: ERPModuleCandidate;
  readonly confidence: number;
}

export interface ERPModuleCandidate {
  readonly moduleId: string;
  readonly moduleName: string;
  readonly domain: string;
  readonly confidence: number;
  readonly matchedEntities: string[];
}

// ─── Convention Analysis ──────────────────────────────────────────────────

export interface ERPConventionAnalysisInput {
  readonly erpProfileId: string;
  readonly entityNames: string[];
  readonly fieldNames: string[];
}

export interface ERPConventionAnalysis {
  readonly erpProfileId: string;
  readonly detectedConventions: ERPConvention[];
  readonly namingConvention:
    | 'snake_case'
    | 'SCREAMING_SNAKE'
    | 'PascalCase'
    | 'camelCase'
    | 'mixed'
    | 'unknown';
  readonly commonPrefixes: string[];
  readonly commonSuffixes: string[];
  readonly strippingInstructions: string[];
  readonly summary: string;
}

export interface ERPConvention {
  readonly id: string;
  readonly type: 'prefix' | 'suffix' | 'naming-rule' | 'module-indicator' | 'version-flag';
  readonly pattern: string;
  readonly description: string;
  readonly observedCount: number;
  readonly confidence: number;
}

// ─── ERP Fingerprint ──────────────────────────────────────────────────────

export interface ERPFingerprint {
  readonly profileId: string;
  readonly erpName: string;
  readonly vendor: string;
  readonly version?: string;

  /** Entity name patterns (regex or prefix/suffix) that identify this ERP */
  readonly entityNamePatterns: string[];

  /** Field name patterns specific to this ERP */
  readonly fieldNamePatterns: string[];

  /** Definitive structural signatures */
  readonly structuralSignatures: ERPStructuralSignature[];

  /** Module sub-fingerprints */
  readonly modules: ERPModuleFingerprint[];
}

export interface ERPStructuralSignature {
  readonly signatureId: string;
  readonly requiredEntityNames?: string[];
  readonly requiredFieldNames?: string[];
  readonly entityNameRegex?: string;
  readonly confidence: number;
  readonly moduleHint?: string;
}

export interface ERPModuleFingerprint {
  readonly moduleId: string;
  readonly moduleName: string;
  readonly domain: string;
  readonly indicatorEntities: string[];
  readonly indicatorPrefixes: string[];
}

// ─── ERP Fingerprint Registry ─────────────────────────────────────────────

export interface ERPFingerprintRegistry {
  register(fingerprint: ERPFingerprint): void;
  getAll(): ERPFingerprint[];
  getByProfile(profileId: string): ERPFingerprint | null;
  getByVendor(vendor: string): ERPFingerprint[];
  score(profileId: string, input: ERPRecognitionInput): number;
}

// ─── Known ERP Modules ────────────────────────────────────────────────────

export const ERP_MODULE_IDS = {
  SAP_MM: 'sap-mm', // Materials Management
  SAP_FI: 'sap-fi', // Financial Accounting
  SAP_SD: 'sap-sd', // Sales & Distribution
  SAP_PP: 'sap-pp', // Production Planning
  SAP_HCM: 'sap-hcm', // Human Capital Management

  TOTVS_ESTOQUE: 'totvs-estoque', // Inventory
  TOTVS_COMPRAS: 'totvs-compras', // Purchasing
  TOTVS_FINANCEIRO: 'totvs-financeiro', // Financial
  TOTVS_CONTABILIDADE: 'totvs-cont', // Accounting
  TOTVS_VENDAS: 'totvs-vendas', // Sales

  ORACLE_INV: 'oracle-inv', // Inventory
  ORACLE_AP: 'oracle-ap', // Accounts Payable
  ORACLE_AR: 'oracle-ar', // Accounts Receivable
  ORACLE_GL: 'oracle-gl', // General Ledger
  ORACLE_PO: 'oracle-po', // Purchasing
} as const;
