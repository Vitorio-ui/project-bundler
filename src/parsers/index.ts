import * as yaml from 'yaml';
import * as toml from 'toml';
import { XMLParser } from 'fast-xml-parser';

/**
 * Parse YAML content to JavaScript object
 */
export function parseYaml(content: string): any {
    try {
        return yaml.parse(content);
    } catch (e) {
        throw new Error(`YAML parse error: ${String(e)}`);
    }
}

/**
 * Parse TOML content to JavaScript object
 */
export function parseToml(content: string): any {
    try {
        return toml.parse(content);
    } catch (e) {
        throw new Error(`TOML parse error: ${String(e)}`);
    }
}

/**
 * Parse XML content to JavaScript object
 */
export function parseXml(content: string): any {
    try {
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            parseAttributeValue: true,
            parseTagValue: true,
            removeNSPrefix: true
        });
        return parser.parse(content);
    } catch (e) {
        throw new Error(`XML parse error: ${String(e)}`);
    }
}

/**
 * Check if content looks like YAML
 */
export function isYamlContent(content: string, filePath?: string): boolean {
    if (filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        if (!ext) return false;
        return ['.yml', '.yaml'].includes(ext);
    }
    // Heuristic: YAML often has key: value patterns without quotes
    return /^\s*\w+:\s*/m.test(content) && !content.trim().startsWith('{');
}

/**
 * Check if content looks like TOML
 */
export function isTomlContent(content: string, filePath?: string): boolean {
    if (filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        if (!ext) return false;
        return ['.toml'].includes(ext);
    }
    // Heuristic: TOML has [section] headers
    return /^\s*\[[\w\-\.]+\]\s*/m.test(content);
}

/**
 * Check if content looks like XML
 */
export function isXmlContent(content: string, filePath?: string): boolean {
    if (filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        if (!ext) return false;
        return ['.xml', '.csproj', '.vbproj', '.fsproj', '.props', '.targets', '.config'].includes(ext);
    }
    // Heuristic: XML starts with <?xml or has <root> tags
    return /^\s*(<\?xml|<[\w\-]+)/m.test(content);
}
