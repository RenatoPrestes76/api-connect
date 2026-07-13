/**
 * @seltriva/plugin-sdk
 * Plugin SDK for building enterprise plugins, connectors, and integrations
 * for the Seltriva Connect Platform.
 *
 * @version 0.1.0
 */
export function definePlugin(factory) {
    return factory;
}
export function validateManifestSchema(manifest) {
    const errors = [];
    const warnings = [];
    if (!manifest || typeof manifest !== 'object') {
        return {
            valid: false,
            errors: [{ field: 'root', message: 'Manifest must be an object' }],
            warnings,
        };
    }
    const m = manifest;
    const required = [
        'id',
        'name',
        'displayName',
        'version',
        'type',
        'description',
        'author',
        'license',
        'runtime',
        'entryPoint',
        'platformVersion',
        'sdkVersion',
    ];
    for (const field of required) {
        if (!m[field]) {
            errors.push({ field, message: `Required field "${field}" is missing` });
        }
    }
    if (m['id'] && typeof m['id'] === 'string') {
        if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(m['id'])) {
            errors.push({
                field: 'id',
                message: 'Plugin ID must be a reverse-domain identifier (e.g. com.vendor.plugin-name)',
            });
        }
    }
    if (m['version'] && typeof m['version'] === 'string') {
        if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/.test(m['version'])) {
            errors.push({ field: 'version', message: 'Version must follow semantic versioning (x.y.z)' });
        }
    }
    const validTypes = [
        'connector',
        'erp-profile',
        'ai-provider',
        'notification',
        'storage',
        'transformation',
        'validator',
        'sync-strategy',
        'mapping-strategy',
        'security-provider',
        'license-provider',
        'export-provider',
    ];
    if (m['type'] && !validTypes.includes(m['type'])) {
        errors.push({ field: 'type', message: `Plugin type must be one of: ${validTypes.join(', ')}` });
    }
    if (!m['capabilities']) {
        warnings.push('capabilities array is missing — defaulting to empty (no capabilities)');
    }
    if (!m['permissions']) {
        warnings.push('permissions array is missing — defaulting to empty (no permissions)');
    }
    return { valid: errors.length === 0, errors, warnings };
}
// ─── Constants ──────────────────────────────────────────────────────────────
export const PLUGIN_SDK_VERSION = '0.1.0';
export const PLUGIN_SDK_CODENAME = 'Forge';
export const MANIFEST_FILE_NAME = 'atlas-plugin.json';
export const PACKAGE_EXTENSION = '.atlasp';
export const PLUGIN_TYPES = [
    'connector',
    'erp-profile',
    'ai-provider',
    'notification',
    'storage',
    'transformation',
    'validator',
    'sync-strategy',
    'mapping-strategy',
    'security-provider',
    'license-provider',
    'export-provider',
];
//# sourceMappingURL=index.js.map