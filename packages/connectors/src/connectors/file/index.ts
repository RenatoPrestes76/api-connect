/**
 * @seltriva/connectors/connectors/file
 * File Connector interfaces — CSV, Excel, XML, JSON, TXT, ODS
 */

import type { Connector, ConnectorConfig, ConnectorResult } from '../../core/index';

// ─── Base File Connector ──────────────────────────────────────────────────

/**
 * Shared base for all file-format connectors.
 * A "file" may live on the local FS, a UNC share, or a stream from a cloud connector.
 */
export interface FileConnector extends Connector {
  readonly type: 'file';

  /** Read all records from the file */
  readAll<TRecord = Record<string, unknown>>(
    source: FileSource,
    options?: FileReadOptions
  ): Promise<ConnectorResult<FileReadResult<TRecord>>>;

  /** Stream records from the file one chunk at a time */
  stream<TRecord = Record<string, unknown>>(
    source: FileSource,
    options?: FileStreamOptions
  ): Promise<ConnectorResult<AsyncIterable<TRecord[]>>>;

  /** Write records to the file (replaces content) */
  write<TRecord = Record<string, unknown>>(
    target: FileTarget,
    records: TRecord[],
    options?: FileWriteOptions
  ): Promise<ConnectorResult<FileWriteResult>>;

  /** Append records to an existing file */
  append<TRecord = Record<string, unknown>>(
    target: FileTarget,
    records: TRecord[],
    options?: FileWriteOptions
  ): Promise<ConnectorResult<FileWriteResult>>;

  /** Detect the schema / column structure of a file */
  detectSchema(source: FileSource): Promise<ConnectorResult<FileSchema>>;

  /** Validate that records conform to a schema — distinct from Connector.validate(config). */
  validateRecords<TRecord = Record<string, unknown>>(
    records: TRecord[],
    schema: FileSchema
  ): Promise<ConnectorResult<FileValidationResult>>;
}

// ─── File Source / Target ─────────────────────────────────────────────────

export interface FileSource {
  readonly path?: string;
  readonly stream?: AsyncIterable<Uint8Array>;
  readonly buffer?: Buffer;
  readonly encoding?: BufferEncoding;
}

export interface FileTarget {
  readonly path: string;
  readonly encoding?: BufferEncoding;
  readonly overwrite?: boolean;
  readonly createDirectory?: boolean;
}

// ─── Common Options ───────────────────────────────────────────────────────

export interface FileReadOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly columns?: string[];
  readonly dateFormat?: string;
  readonly numberFormat?: string;
  readonly nullValues?: string[];
  readonly trimValues?: boolean;
}

export interface FileStreamOptions extends FileReadOptions {
  readonly chunkSize?: number;
}

export interface FileWriteOptions {
  readonly dateFormat?: string;
  readonly numberFormat?: string;
  readonly nullValue?: string;
  readonly includeHeader?: boolean;
}

// ─── Schema + Validation ──────────────────────────────────────────────────

export interface FileSchema {
  readonly columns: FileColumn[];
  readonly rowCount?: number;
  readonly sampleRows?: Record<string, unknown>[];
}

export interface FileColumn {
  readonly name: string;
  readonly index: number;
  readonly inferredType: 'string' | 'number' | 'boolean' | 'date' | 'null' | 'unknown';
  readonly nullable: boolean;
  readonly maxLength?: number;
  readonly samples?: unknown[];
}

export interface FileReadResult<TRecord = Record<string, unknown>> {
  readonly records: TRecord[];
  readonly totalRows: number;
  readonly schema: FileSchema;
  readonly durationMs: number;
  readonly warnings: FileWarning[];
}

export interface FileWriteResult {
  readonly rowsWritten: number;
  readonly bytesWritten: number;
  readonly durationMs: number;
}

export interface FileValidationResult {
  readonly isValid: boolean;
  readonly errors: FileValidationError[];
  readonly warnings: FileWarning[];
  readonly rowsChecked: number;
}

export interface FileValidationError {
  readonly row: number;
  readonly column: string;
  readonly value: unknown;
  readonly message: string;
  readonly code: string;
}

export interface FileWarning {
  readonly row?: number;
  readonly column?: string;
  readonly message: string;
}

// ─── CSV Connector ────────────────────────────────────────────────────────

export interface CSVConnector extends FileConnector {
  readonly subtype: 'csv';

  /** Re-read only changed rows since a given byte offset (for incremental loads) */
  readFrom<TRecord = Record<string, unknown>>(
    source: FileSource,
    byteOffset: number,
    options?: FileReadOptions
  ): Promise<ConnectorResult<FileReadResult<TRecord>>>;
}

export interface CSVConnectorConfig extends ConnectorConfig {
  readonly delimiter?: string;
  readonly quoteChar?: string;
  readonly escapeChar?: string;
  readonly hasHeader?: boolean;
  readonly skipLines?: number;
  readonly encoding?: BufferEncoding;
  readonly lineTerminator?: 'auto' | '\n' | '\r\n' | '\r';
  readonly commentChar?: string;
  readonly strictQuotes?: boolean;
  readonly trimHeaders?: boolean;
}

// ─── Excel Connector ──────────────────────────────────────────────────────

export interface ExcelConnector extends FileConnector {
  readonly subtype: 'excel';

  /** List all sheet names */
  listSheets(source: FileSource): Promise<ConnectorResult<ExcelSheet[]>>;

  /** Read a specific sheet */
  readSheet<TRecord = Record<string, unknown>>(
    source: FileSource,
    sheet: string | number,
    options?: ExcelReadOptions
  ): Promise<ConnectorResult<FileReadResult<TRecord>>>;

  /** Write multiple sheets in a single workbook */
  writeWorkbook(
    target: FileTarget,
    sheets: ExcelSheetData[],
    options?: ExcelWriteOptions
  ): Promise<ConnectorResult<FileWriteResult>>;

  /** Read named ranges */
  readNamedRange(source: FileSource, rangeName: string): Promise<ConnectorResult<unknown[][]>>;
}

export interface ExcelSheet {
  readonly name: string;
  readonly index: number;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly hidden: boolean;
}

export interface ExcelSheetData {
  readonly name: string;
  readonly records: Record<string, unknown>[];
  readonly columns?: ExcelColumnConfig[];
}

export interface ExcelColumnConfig {
  readonly key: string;
  readonly header?: string;
  readonly width?: number;
  readonly format?: string;
  readonly type?: 'string' | 'number' | 'boolean' | 'date';
}

export interface ExcelReadOptions extends FileReadOptions {
  readonly sheet?: string | number;
  readonly headerRow?: number;
  readonly dataStartRow?: number;
  readonly dataEndRow?: number;
  readonly cellFormulas?: boolean;
  readonly richText?: boolean;
}

export interface ExcelWriteOptions extends FileWriteOptions {
  readonly password?: string;
  readonly creator?: string;
}

// ─── XML Connector ────────────────────────────────────────────────────────

export interface XMLConnector extends FileConnector {
  readonly subtype: 'xml';

  /** Read records at a given XPath selector */
  readXPath<TRecord = Record<string, unknown>>(
    source: FileSource,
    xpath: string,
    options?: XMLReadOptions
  ): Promise<ConnectorResult<FileReadResult<TRecord>>>;

  /** Parse the XML into a structured document tree */
  parse(source: FileSource, options?: XMLParseOptions): Promise<ConnectorResult<XMLDocument>>;

  /** Serialize a document tree back to XML string */
  serialize(document: XMLDocument, options?: XMLSerializeOptions): ConnectorResult<string>;

  /** Transform with XSLT */
  transform(
    source: FileSource,
    xslt: FileSource,
    params?: Record<string, string>
  ): Promise<ConnectorResult<string>>;

  /** Validate against XSD */
  validateSchema(
    source: FileSource,
    xsd: FileSource
  ): Promise<ConnectorResult<FileValidationResult>>;
}

export interface XMLReadOptions extends FileReadOptions {
  readonly recordElement?: string;
  readonly attributePrefix?: string;
  readonly textNodeKey?: string;
  readonly namespaces?: Record<string, string>;
  readonly flatten?: boolean;
}

export interface XMLParseOptions {
  readonly namespaces?: Record<string, string>;
  readonly preserveComments?: boolean;
  readonly preserveWhitespace?: boolean;
}

export interface XMLSerializeOptions {
  readonly indent?: number;
  readonly declaration?: boolean;
  readonly encoding?: string;
}

export interface XMLDocument {
  readonly root: XMLNode;
  readonly declaration?: XMLDeclaration;
}

export interface XMLNode {
  readonly name: string;
  readonly namespace?: string;
  readonly attributes: Record<string, string>;
  readonly children: XMLNode[];
  readonly text?: string;
}

export interface XMLDeclaration {
  readonly version: string;
  readonly encoding?: string;
  readonly standalone?: boolean;
}

export interface XMLConnectorConfig extends ConnectorConfig {
  readonly encoding?: string;
  readonly preserveOrder?: boolean;
  readonly ignoreAttributes?: boolean;
  readonly attributePrefix?: string;
  readonly textNodeKey?: string;
  readonly parseAttributeValue?: boolean;
  readonly trimValues?: boolean;
}

// ─── JSON Connector ───────────────────────────────────────────────────────

export interface JSONConnector extends FileConnector {
  readonly subtype: 'json';

  /** Read using a JSONPath expression to select records */
  readJsonPath<TRecord = Record<string, unknown>>(
    source: FileSource,
    jsonPath: string,
    options?: FileReadOptions
  ): Promise<ConnectorResult<FileReadResult<TRecord>>>;

  /** Parse a JSON Lines (.jsonl / .ndjson) file */
  readLines<TRecord = Record<string, unknown>>(
    source: FileSource,
    options?: FileReadOptions
  ): Promise<ConnectorResult<FileReadResult<TRecord>>>;

  /** Write as JSON Lines */
  writeLines<TRecord = Record<string, unknown>>(
    target: FileTarget,
    records: TRecord[],
    options?: JSONWriteOptions
  ): Promise<ConnectorResult<FileWriteResult>>;
}

export interface JSONWriteOptions extends FileWriteOptions {
  readonly pretty?: boolean;
  readonly indent?: number;
  readonly sortKeys?: boolean;
  readonly replacer?: string[];
}

export interface JSONConnectorConfig extends ConnectorConfig {
  readonly encoding?: BufferEncoding;
  readonly parseNumbers?: boolean;
  readonly parseDates?: boolean;
  readonly dateFields?: string[];
}

// ─── TXT Connector ────────────────────────────────────────────────────────

export interface TXTConnector extends FileConnector {
  readonly subtype: 'txt';

  /** Read raw lines */
  readLines(source: FileSource, options?: TXTReadOptions): Promise<ConnectorResult<TXTReadResult>>;

  /** Read fixed-width records */
  readFixedWidth(
    source: FileSource,
    columns: FixedWidthColumn[]
  ): Promise<ConnectorResult<FileReadResult>>;

  /** Tail the file (read last N lines) */
  tail(source: FileSource, lineCount: number): Promise<ConnectorResult<string[]>>;

  /** Watch for new lines appended to the file */
  watch(source: FileSource, handler: (lines: string[]) => void): ConnectorResult<TXTWatcher>;
}

export interface TXTReadOptions extends FileReadOptions {
  readonly skipEmptyLines?: boolean;
  readonly stripBom?: boolean;
  readonly maxLineLength?: number;
}

export interface TXTReadResult {
  readonly lines: string[];
  readonly totalLines: number;
  readonly durationMs: number;
}

export interface FixedWidthColumn {
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly type?: 'string' | 'number' | 'date';
  readonly trim?: boolean;
}

export interface TXTWatcher {
  stop(): void;
  isActive(): boolean;
}

export interface TXTConnectorConfig extends ConnectorConfig {
  readonly encoding?: BufferEncoding;
  readonly lineTerminator?: 'auto' | '\n' | '\r\n' | '\r';
}

// ─── ODS Connector ────────────────────────────────────────────────────────

/**
 * ODS (OpenDocument Spreadsheet) — LibreOffice / OpenOffice format
 */
export interface ODSConnector extends FileConnector {
  readonly subtype: 'ods';

  /** List sheets */
  listSheets(source: FileSource): Promise<ConnectorResult<ODSSheet[]>>;

  /** Read a specific sheet */
  readSheet<TRecord = Record<string, unknown>>(
    source: FileSource,
    sheet: string | number,
    options?: FileReadOptions
  ): Promise<ConnectorResult<FileReadResult<TRecord>>>;

  /** Write multiple sheets in a single ODS workbook */
  writeWorkbook(
    target: FileTarget,
    sheets: ODSSheetData[],
    options?: FileWriteOptions
  ): Promise<ConnectorResult<FileWriteResult>>;
}

export interface ODSSheet {
  readonly name: string;
  readonly index: number;
  readonly rowCount: number;
  readonly columnCount: number;
}

export interface ODSSheetData {
  readonly name: string;
  readonly records: Record<string, unknown>[];
}

export interface ODSConnectorConfig extends ConnectorConfig {
  readonly password?: string;
}
