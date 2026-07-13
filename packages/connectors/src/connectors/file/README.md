# @seltriva/connectors/connectors/file

File Connector interfaces — structured file format reading and writing.

## Supported Formats

| Connector        | Subtype | Format            | Notes                                 |
| ---------------- | ------- | ----------------- | ------------------------------------- |
| `CSVConnector`   | `csv`   | RFC 4180 CSV      | Configurable delimiter, quote, escape |
| `ExcelConnector` | `excel` | XLSX / XLS        | Multi-sheet, named ranges             |
| `XMLConnector`   | `xml`   | XML + XSD + XSLT  | XPath, namespace-aware                |
| `JSONConnector`  | `json`  | JSON / JSON Lines | JSONPath, ndjson                      |
| `TXTConnector`   | `txt`   | Plain text        | Fixed-width, tail, watch              |
| `ODSConnector`   | `ods`   | OpenDocument      | LibreOffice / OpenOffice              |

## Interface Hierarchy

```
Connector (universal base)
  └─ FileConnector
       ├─ CSVConnector      (readFrom byte offset for incremental loads)
       ├─ ExcelConnector    (multi-sheet, named ranges, writeWorkbook)
       ├─ XMLConnector      (XPath, XSLT, XSD validation)
       ├─ JSONConnector     (JSONPath, JSON Lines)
       ├─ TXTConnector      (fixed-width, tail, watch)
       └─ ODSConnector      (multi-sheet, LibreOffice)
```

## Common Pattern (all file connectors)

```typescript
const connector: FileConnector = ...;

// Read all records
const result = await connector.readAll({ path: '/data/customers.csv' });
result.data?.records.forEach(r => console.log(r));

// Stream large files
for await (const chunk of await connector.stream({ path: '/data/huge.csv' })) {
  processChunk(chunk);
}

// Write
await connector.write({ path: '/out/result.csv' }, records);

// Schema detection
const schema = await connector.detectSchema({ path: '/data/unknown.csv' });
```

## CSV

```typescript
const csv: CSVConnector = ...;

// Incremental load from byte offset
const result = await csv.readFrom({ path: '/logs/access.log' }, lastByteOffset);
```

## Excel

```typescript
const xlsx: ExcelConnector = ...;

const sheets = await xlsx.listSheets({ path: '/reports/sales.xlsx' });
const data = await xlsx.readSheet({ path: '/reports/sales.xlsx' }, 'Q4');

await xlsx.writeWorkbook({ path: '/out/report.xlsx' }, [
  { name: 'Q1', records: q1Data },
  { name: 'Q2', records: q2Data },
]);
```

## XML

```typescript
const xml: XMLConnector = ...;

// Read specific elements with XPath
const result = await xml.readXPath({ path: '/data/orders.xml' }, '//Order');

// Validate against XSD
await xml.validateSchema({ path: '/data/input.xml' }, { path: '/schemas/order.xsd' });

// Transform with XSLT
const output = await xml.transform({ path: '/in.xml' }, { path: '/transform.xslt' });
```

## JSON

```typescript
const json: JSONConnector = ...;

// Select with JSONPath
const result = await json.readJsonPath({ path: '/data/api.json' }, '$.data.items[*]');

// JSON Lines (ndjson)
const lines = await json.readLines({ path: '/logs/events.ndjson' });
await json.writeLines({ path: '/out/events.ndjson' }, records, { pretty: false });
```

## TXT

```typescript
const txt: TXTConnector = ...;

// Fixed-width
const result = await txt.readFixedWidth({ path: '/data/legacy.txt' }, [
  { name: 'customerId', start: 0, end: 8 },
  { name: 'name', start: 8, end: 38 },
]);

// Live tail
const watcher = txt.watch({ path: '/logs/app.log' }, (lines) => console.log(lines));
// Later:
watcher.data?.stop();
```

## Constraints

- No implementations in this module.
- `FileSource.buffer` and `FileSource.stream` allow processing files without writing to disk.
- `TXTConnector.watch()` returns synchronously — the returned `TXTWatcher` controls the live tail loop.
- All `read*` methods detect encoding automatically unless `encoding` is explicitly set in config.
