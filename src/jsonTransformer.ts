import * as path from 'path';
import { TokenStats } from './tokenStats';
import { parseYaml, parseToml, parseXml, isYamlContent, isTomlContent, isXmlContent } from './parsers';

/**
 * Result of JSON transformation
 */
export interface JsonTransformResult {
    transformed: string;      // YAML-like output for AI
    originalTokens: number;   // Estimated tokens before transformation
    newTokens: number;        // Estimated tokens after transformation
    savings: number;          // Percentage saved (0-100)
}

/**
 * Interface for specific JSON transformers
 */
export interface JsonTransformer {
    /**
     * Check if this transformer can handle the given file
     */
    canTransform(filePath: string): boolean;
    
    /**
     * Transform JSON content to AI-friendly format
     */
    transform(content: string, filePath: string): JsonTransformResult;
}

/**
 * Main JSON Transformer class
 * Routes files to specific transformers based on filename
 */
export class JsonTransformerEngine {
    private transformers: JsonTransformer[] = [];

    constructor() {
        // Register transformers in order of specificity
        this.registerTransformer(new PackageJsonTransformer());
        this.registerTransformer(new PackageLockJsonTransformer());
        this.registerTransformer(new TsconfigTransformer());
        this.registerTransformer(new VsCodeSettingsTransformer());
        // Language-specific transformers
        this.registerTransformer(new PythonTransformer());
        this.registerTransformer(new RustTransformer());
        this.registerTransformer(new GoTransformer());
        this.registerTransformer(new PhpTransformer());
        this.registerTransformer(new RubyTransformer());
    }

    /**
     * Register a new transformer
     */
    registerTransformer(transformer: JsonTransformer): void {
        this.transformers.push(transformer);
    }

    /**
     * Check if a file can be transformed
     */
    canTransform(filePath: string): boolean {
        return this.transformers.some(t => t.canTransform(filePath));
    }

    /**
     * Transform content to AI-friendly format
     * Supports JSON, YAML, TOML, XML
     * Returns original content if no transformer matches
     */
    transform(content: string, filePath: string): JsonTransformResult {
        // Try specific transformers first
        const transformer = this.transformers.find(t => t.canTransform(filePath));
        if (transformer) {
            return transformer.transform(content, filePath);
        }

        // Try to detect format and parse
        try {
            let obj: any;
            const ext = path.extname(filePath).toLowerCase();

            // YAML
            if (['.yml', '.yaml'].includes(ext) || isYamlContent(content, filePath)) {
                obj = parseYaml(content);
                return this.transformParsed(obj, filePath, content);
            }

            // TOML
            if (ext === '.toml' || isTomlContent(content, filePath)) {
                obj = parseToml(content);
                return this.transformParsed(obj, filePath, content);
            }

            // XML
            if (['.xml', '.csproj', '.vbproj', '.fsproj', '.props', '.targets', '.config'].includes(ext) || isXmlContent(content, filePath)) {
                obj = parseXml(content);
                return this.transformParsed(obj, filePath, content);
            }

            // Fallback: generic JSON to YAML-like conversion
            return this.genericTransform(content, filePath);
        } catch {
            // Invalid content, return as-is
            return {
                transformed: content,
                originalTokens: TokenStats.estimateForFile(content, path.extname(filePath)),
                newTokens: TokenStats.estimateForFile(content, path.extname(filePath)),
                savings: 0
            };
        }
    }

    /**
     * Transform parsed object (from JSON/YAML/TOML/XML) to YAML-like format
     */
    private transformParsed(obj: any, filePath: string, originalContent: string): JsonTransformResult {
        const lines = this.objectToYamlLike(obj, 0);
        const transformed = lines.join('\n');

        const originalTokens = TokenStats.estimateForFile(originalContent, path.extname(filePath));
        const newTokens = TokenStats.estimateForFile(transformed, '.json');
        const savings = originalTokens > 0
            ? Math.round((1 - newTokens / originalTokens) * 100)
            : 0;

        return {
            transformed: `# ${path.basename(filePath)}\n${transformed}`,
            originalTokens,
            newTokens,
            savings: Math.max(0, savings)
        };
    }

    /**
     * Generic JSON to YAML-like transformation
     */
    private genericTransform(content: string, filePath: string): JsonTransformResult {
        try {
            const obj = JSON.parse(content);
            const lines = this.objectToYamlLike(obj, 0);
            const transformed = lines.join('\n');

            const originalTokens = TokenStats.estimateForFile(content, '.json');
            const newTokens = TokenStats.estimateForFile(transformed, '.json');
            const savings = originalTokens > 0 
                ? Math.round((1 - newTokens / originalTokens) * 100) 
                : 0;

            return {
                transformed: `# ${path.basename(filePath)}\n${transformed}`,
                originalTokens,
                newTokens,
                savings: Math.max(0, savings)
            };
        } catch {
            // Invalid JSON, return as-is
            return {
                transformed: content,
                originalTokens: TokenStats.estimateForFile(content, '.json'),
                newTokens: TokenStats.estimateForFile(content, '.json'),
                savings: 0
            };
        }
    }

    /**
     * Convert JSON object to YAML-like lines
     * With smart compression for large arrays, deep nesting, and binary data
     */
    private objectToYamlLike(obj: any, indent: number, depth: number = 0): string[] {
        const lines: string[] = [];
        const prefix = '  '.repeat(indent);

        // J-18: Deep nesting limit (>5 levels → [nested])
        if (depth > 5) {
            lines.push(`${prefix}[nested object - max depth exceeded]`);
            return lines;
        }

        if (Array.isArray(obj)) {
            // J-17: Large array compression (50+ items → [50 items])
            if (obj.length > 50) {
                for (let i = 0; i < 30; i++) {
                    const item = obj[i];
                    if (typeof item === 'object' && item !== null) {
                        lines.push(`${prefix}-`);
                        lines.push(...this.objectToYamlLike(item, indent + 1, depth + 1));
                    } else {
                        lines.push(`${prefix}- ${this.formatValue(item)}`);
                    }
                }
                lines.push(`${prefix}- ... and ${obj.length - 30} more items`);
            } else {
                for (const item of obj) {
                    if (typeof item === 'object' && item !== null) {
                        lines.push(`${prefix}-`);
                        lines.push(...this.objectToYamlLike(item, indent + 1, depth + 1));
                    } else {
                        lines.push(`${prefix}- ${this.formatValue(item)}`);
                    }
                }
            }
        } else if (typeof obj === 'object' && obj !== null) {
            for (const [key, value] of Object.entries(obj)) {
                // J-19: Binary data filter (base64, hashes)
                if (typeof value === 'string' && this.isBinaryData(value)) {
                    lines.push(`${prefix}${key}: [${this.getBinaryDataType(value)}]`);
                    continue;
                }

                if (typeof value === 'object' && value !== null) {
                    lines.push(`${prefix}${key}:`);
                    lines.push(...this.objectToYamlLike(value, indent + 1, depth + 1));
                } else {
                    lines.push(`${prefix}${key}: ${this.formatValue(value)}`);
                }
            }
        }

        return lines;
    }

    /**
     * Check if a string looks like binary data (base64, hash, etc.)
     */
    private isBinaryData(value: string): boolean {
        // Too short to be binary data
        if (value.length < 32) return false;

        // Base64 pattern (long string with base64 characters)
        if (/^[A-Za-z0-9+/=]{64,}$/.test(value)) return true;

        // Hex hash (MD5, SHA1, SHA256, etc.)
        if (/^[a-f0-9]{32,}$/.test(value)) return true;

        // Very long string that looks like encoded data
        if (value.length > 200 && !/\s/.test(value)) return true;

        return false;
    }

    /**
     * Get type of binary data for display
     */
    private getBinaryDataType(value: string): string {
        if (/^[a-f0-9]{64}$/.test(value)) return 'sha256 hash';
        if (/^[a-f0-9]{40}$/.test(value)) return 'sha1 hash';
        if (/^[a-f0-9]{32}$/.test(value)) return 'md5 hash';
        if (/^[A-Za-z0-9+/=]{64,}$/.test(value)) return 'base64 data';
        return 'binary data';
    }

    /**
     * Format a primitive value for output
     */
    private formatValue(value: any): string {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'boolean') return value.toString();
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'string') {
            // Escape quotes and wrap in quotes if needed
            if (value.includes('\n') || value.includes('"') || value.length > 50) {
                return JSON.stringify(value);
            }
            return value;
        }
        return JSON.stringify(value);
    }
}

// ============================================================================
// SPECIFIC TRANSFORMERS
// ============================================================================

/**
 * Transformer for package.json
 */
class PackageJsonTransformer implements JsonTransformer {
    canTransform(filePath: string): boolean {
        return path.basename(filePath) === 'package.json';
    }

    transform(content: string, filePath: string): JsonTransformResult {
        try {
            const pkg = JSON.parse(content);
            const lines: string[] = [`# ${path.basename(filePath)}`];

            // Core metadata
            if (pkg.name) lines.push(`name: ${pkg.name}`);
            if (pkg.version) lines.push(`version: ${pkg.version}`);
            if (pkg.description) lines.push(`description: ${pkg.description}`);
            if (pkg.publisher) lines.push(`publisher: ${pkg.publisher}`);
            if (pkg.author) {
                const author = typeof pkg.author === 'string' ? pkg.author : pkg.author.name;
                lines.push(`author: ${author}`);
            }
            if (pkg.license) lines.push(`license: ${pkg.license}`);

            // Repository
            if (pkg.repository) {
                const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository.url;
                lines.push(`repository: ${repo}`);
            }

            // Engines
            if (pkg.engines) {
                lines.push('');
                lines.push('[engines]');
                for (const [engine, version] of Object.entries(pkg.engines)) {
                    lines.push(`  ${engine}: ${version}`);
                }
            }

            // Main/entry points
            if (pkg.main) lines.push(`main: ${pkg.main}`);
            if (pkg.bin) {
                lines.push(`bin: ${typeof pkg.bin === 'string' ? pkg.bin : Object.keys(pkg.bin).join(', ')}`);
            }

            // Scripts
            if (pkg.scripts) {
                lines.push('');
                lines.push('[scripts]');
                for (const [name, command] of Object.entries(pkg.scripts)) {
                    lines.push(`  ${name}: ${command}`);
                }
            }

            // Dependencies
            if (pkg.dependencies) {
                lines.push('');
                lines.push('[dependencies]');
                for (const [name, version] of Object.entries(pkg.dependencies)) {
                    lines.push(`  ${name}: ${version}`);
                }
            }

            // DevDependencies
            if (pkg.devDependencies) {
                lines.push('');
                lines.push('[devDependencies]');
                for (const [name, version] of Object.entries(pkg.devDependencies)) {
                    lines.push(`  ${name}: ${version}`);
                }
            }

            // PeerDependencies
            if (pkg.peerDependencies) {
                lines.push('');
                lines.push('[peerDependencies]');
                for (const [name, version] of Object.entries(pkg.peerDependencies)) {
                    lines.push(`  ${name}: ${version}`);
                }
            }

            // Keywords
            if (pkg.keywords && pkg.keywords.length > 0) {
                lines.push('');
                lines.push(`keywords: ${pkg.keywords.join(', ')}`);
            }

            // Categories (VS Code specific)
            if (pkg.categories) {
                lines.push(`categories: ${pkg.categories.join(', ')}`);
            }

            // Activation Events (VS Code specific)
            if (pkg.activationEvents) {
                lines.push(`activationEvents: ${pkg.activationEvents.join(', ')}`);
            }

            const transformed = lines.join('\n');
            const originalTokens = TokenStats.estimateForFile(content, '.json');
            const newTokens = TokenStats.estimateForFile(transformed, '.json');
            const savings = originalTokens > 0 
                ? Math.round((1 - newTokens / originalTokens) * 100) 
                : 0;

            return {
                transformed,
                originalTokens,
                newTokens,
                savings: Math.max(0, savings)
            };
        } catch (e) {
            return {
                transformed: content,
                originalTokens: TokenStats.estimateForFile(content, '.json'),
                newTokens: TokenStats.estimateForFile(content, '.json'),
                savings: 0
            };
        }
    }
}

/**
 * Transformer for package-lock.json
 * Extracts only the dependency tree structure, omitting integrity hashes and detailed info
 */
class PackageLockJsonTransformer implements JsonTransformer {
    canTransform(filePath: string): boolean {
        return path.basename(filePath) === 'package-lock.json';
    }

    transform(content: string, filePath: string): JsonTransformResult {
        try {
            const lock = JSON.parse(content);
            const lines: string[] = [`# ${path.basename(filePath)}`];

            // Lockfile version
            if (lock.lockfileVersion) {
                lines.push(`lockfileVersion: ${lock.lockfileVersion}`);
            }

            // Name and version
            if (lock.name) lines.push(`name: ${lock.name}`);
            if (lock.version) lines.push(`version: ${lock.version}`);

            // Dependencies tree (simplified)
            if (lock.packages) {
                lines.push('');
                lines.push('[packages]');
                lines.push(...this.extractPackagesTree(lock.packages, 0));
            } else if (lock.dependencies) {
                lines.push('');
                lines.push('[dependencies]');
                lines.push(...this.extractDependenciesTree(lock.dependencies, 0));
            }

            const transformed = lines.join('\n');
            const originalTokens = TokenStats.estimateForFile(content, '.json');
            const newTokens = TokenStats.estimateForFile(transformed, '.json');
            const savings = originalTokens > 0 
                ? Math.round((1 - newTokens / originalTokens) * 100) 
                : 0;

            return {
                transformed,
                originalTokens,
                newTokens,
                savings: Math.max(0, savings)
            };
        } catch (e) {
            return {
                transformed: content,
                originalTokens: TokenStats.estimateForFile(content, '.json'),
                newTokens: TokenStats.estimateForFile(content, '.json'),
                savings: 0
            };
        }
    }

    /**
     * Extract packages tree (npm v2/v3 format)
     */
    private extractPackagesTree(packages: any, indent: number, maxDepth: number = 3): string[] {
        const lines: string[] = [];
        const prefix = '  '.repeat(indent);
        
        // Count packages by type
        let directDeps = 0;
        const depTypes = new Set<string>();

        for (const [pkgPath, pkgInfo] of Object.entries(packages) as [string, any][]) {
            if (pkgPath === '') continue; // Root package
            
            const parts = pkgPath.split('node_modules/');
            if (parts.length <= maxDepth + 1) {
                directDeps++;
                if (pkgInfo.dev) depTypes.add('dev');
                if (pkgInfo.optional) depTypes.add('optional');
                if (pkgInfo.peer) depTypes.add('peer');
            }
        }

        lines.push(`${prefix}total: ${Object.keys(packages).length - 1} packages`);
        if (directDeps > 0) {
            lines.push(`${prefix}direct: ${directDeps}`);
        }
        if (depTypes.size > 0) {
            lines.push(`${prefix}types: ${Array.from(depTypes).join(', ')}`);
        }

        // Show first-level dependencies in detail
        const firstLevel = new Set<string>();
        for (const [pkgPath, pkgInfo] of Object.entries(packages) as [string, any][]) {
            if (pkgPath === '') continue;
            const parts = pkgPath.split('node_modules/');
            if (parts.length === 2 && !parts[1].includes('/')) {
                firstLevel.add(`${parts[1]}@${pkgInfo.version}`);
            }
        }

        if (firstLevel.size > 0) {
            lines.push(`${prefix}top-level:`);
            const sorted = Array.from(firstLevel).sort().slice(0, 50);
            for (const dep of sorted) {
                lines.push(`${prefix}  - ${dep}`);
            }
            if (firstLevel.size > 50) {
                lines.push(`${prefix}  ... and ${firstLevel.size - 50} more`);
            }
        }

        return lines;
    }

    /**
     * Extract dependencies tree (npm v1 format)
     */
    private extractDependenciesTree(deps: any, indent: number, maxDepth: number = 3): string[] {
        if (indent >= maxDepth || !deps) return [];

        const lines: string[] = [];
        const prefix = '  '.repeat(indent);

        for (const [name, info] of Object.entries(deps) as [string, any][]) {
            lines.push(`${prefix}- ${name}@${info.version}`);
            if (info.dependencies) {
                lines.push(...this.extractDependenciesTree(info.dependencies, indent + 1, maxDepth));
            }
        }

        return lines;
    }
}

/**
 * Transformer for tsconfig.json
 */
class TsconfigTransformer implements JsonTransformer {
    canTransform(filePath: string): boolean {
        return path.basename(filePath) === 'tsconfig.json';
    }

    transform(content: string, filePath: string): JsonTransformResult {
        try {
            const config = JSON.parse(content);
            const lines: string[] = [`# ${path.basename(filePath)}`];

            // Extends
            if (config.extends) {
                lines.push(`extends: ${config.extends}`);
            }

            // Compiler options
            if (config.compilerOptions) {
                lines.push('');
                lines.push('[compilerOptions]');
                const opts = config.compilerOptions;
                
                // Target and module
                if (opts.target) lines.push(`  target: ${opts.target}`);
                if (opts.module) lines.push(`  module: ${opts.module}`);
                if (opts.lib) lines.push(`  lib: ${Array.isArray(opts.lib) ? opts.lib.join(', ') : opts.lib}`);
                
                // Output
                if (opts.outDir) lines.push(`  outDir: ${opts.outDir}`);
                if (opts.rootDir) lines.push(`  rootDir: ${opts.rootDir}`);
                if (opts.declaration) lines.push(`  declaration: ${opts.declaration}`);
                if (opts.declarationMap) lines.push(`  declarationMap: ${opts.declarationMap}`);
                if (opts.sourceMap) lines.push(`  sourceMap: ${opts.sourceMap}`);
                
                // Strict mode
                if (opts.strict) lines.push(`  strict: ${opts.strict}`);
                if (opts.noImplicitAny) lines.push(`  noImplicitAny: ${opts.noImplicitAny}`);
                if (opts.strictNullChecks) lines.push(`  strictNullChecks: ${opts.strictNullChecks}`);
                
                // Module resolution
                if (opts.moduleResolution) lines.push(`  moduleResolution: ${opts.moduleResolution}`);
                if (opts.baseUrl) lines.push(`  baseUrl: ${opts.baseUrl}`);
                if (opts.paths) {
                    lines.push(`  paths:`);
                    for (const [path, mapping] of Object.entries(opts.paths)) {
                        lines.push(`    ${path}: ${Array.isArray(mapping) ? mapping.join(', ') : mapping}`);
                    }
                }
                
                // ES module interop
                if (opts.esModuleInterop) lines.push(`  esModuleInterop: ${opts.esModuleInterop}`);
                if (opts.allowSyntheticDefaultImports) lines.push(`  allowSyntheticDefaultImports: ${opts.allowSyntheticDefaultImports}`);
                
                // Other important options
                if (opts.skipLibCheck) lines.push(`  skipLibCheck: ${opts.skipLibCheck}`);
                if (opts.forceConsistentCasingInFileNames) lines.push(`  forceConsistentCasingInFileNames: ${opts.forceConsistentCasingInFileNames}`);
                if (opts.resolveJsonModule) lines.push(`  resolveJsonModule: ${opts.resolveJsonModule}`);
                if (opts.isolatedModules) lines.push(`  isolatedModules: ${opts.isolatedModules}`);
            }

            // Include
            if (config.include) {
                lines.push('');
                lines.push('[include]');
                for (const pattern of config.include) {
                    lines.push(`  - ${pattern}`);
                }
            }

            // Exclude
            if (config.exclude) {
                lines.push('');
                lines.push('[exclude]');
                for (const pattern of config.exclude) {
                    lines.push(`  - ${pattern}`);
                }
            }

            // References
            if (config.references && config.references.length > 0) {
                lines.push('');
                lines.push('[references]');
                for (const ref of config.references) {
                    lines.push(`  - ${ref.path}`);
                }
            }

            const transformed = lines.join('\n');
            const originalTokens = TokenStats.estimateForFile(content, '.json');
            const newTokens = TokenStats.estimateForFile(transformed, '.json');
            const savings = originalTokens > 0 
                ? Math.round((1 - newTokens / originalTokens) * 100) 
                : 0;

            return {
                transformed,
                originalTokens,
                newTokens,
                savings: Math.max(0, savings)
            };
        } catch (e) {
            return {
                transformed: content,
                originalTokens: TokenStats.estimateForFile(content, '.json'),
                newTokens: TokenStats.estimateForFile(content, '.json'),
                savings: 0
            };
        }
    }
}

/**
 * Transformer for VS Code settings files
 * Handles: .vscode/settings.json, .vscode/launch.json, .vscode/tasks.json
 */
class VsCodeSettingsTransformer implements JsonTransformer {
    canTransform(filePath: string): boolean {
        const basename = path.basename(filePath);
        const dirname = path.basename(path.dirname(filePath));
        return dirname === '.vscode' && ['settings.json', 'launch.json', 'tasks.json', 'extensions.json'].includes(basename);
    }

    transform(content: string, filePath: string): JsonTransformResult {
        const basename = path.basename(filePath);
        
        try {
            const config = JSON.parse(content);
            const lines: string[] = [`# ${basename}`];

            if (basename === 'settings.json') {
                lines.push(...this.transformSettings(config));
            } else if (basename === 'launch.json') {
                lines.push(...this.transformLaunch(config));
            } else if (basename === 'tasks.json') {
                lines.push(...this.transformTasks(config));
            } else if (basename === 'extensions.json') {
                lines.push(...this.transformExtensions(config));
            }

            const transformed = lines.join('\n');
            const originalTokens = TokenStats.estimateForFile(content, '.json');
            const newTokens = TokenStats.estimateForFile(transformed, '.json');
            const savings = originalTokens > 0 
                ? Math.round((1 - newTokens / originalTokens) * 100) 
                : 0;

            return {
                transformed,
                originalTokens,
                newTokens,
                savings: Math.max(0, savings)
            };
        } catch (e) {
            return {
                transformed: content,
                originalTokens: TokenStats.estimateForFile(content, '.json'),
                newTokens: TokenStats.estimateForFile(content, '.json'),
                savings: 0
            };
        }
    }

    private transformSettings(config: any): string[] {
        const lines: string[] = ['[settings]'];
        
        // Group settings by category
        const categories: Record<string, Record<string, any>> = {};
        
        for (const [key, value] of Object.entries(config)) {
            const parts = key.split('.');
            const category = parts[0];
            if (!categories[category]) {
                categories[category] = {};
            }
            categories[category][key] = value;
        }

        for (const [category, settings] of Object.entries(categories)) {
            lines.push(`  ${category}:`);
            for (const [key, value] of Object.entries(settings)) {
                const shortKey = key.replace(`${category}.`, '');
                lines.push(`    ${shortKey}: ${this.formatValue(value)}`);
            }
        }

        return lines;
    }

    private transformLaunch(config: any): string[] {
        const lines: string[] = ['[launch configurations]'];
        
        if (config.version) {
            lines.push(`  version: ${config.version}`);
        }
        
        if (config.configurations && Array.isArray(config.configurations)) {
            for (const cfg of config.configurations) {
                lines.push(`  - name: ${cfg.name || 'unnamed'}`);
                lines.push(`    type: ${cfg.type || 'unknown'}`);
                lines.push(`    request: ${cfg.request || 'unknown'}`);
                if (cfg.program) lines.push(`    program: ${cfg.program}`);
                if (cfg.cwd) lines.push(`    cwd: ${cfg.cwd}`);
                if (cfg.env) lines.push(`    env: ${JSON.stringify(cfg.env)}`);
            }
        }

        return lines;
    }

    private transformTasks(config: any): string[] {
        const lines: string[] = ['[tasks]'];
        
        if (config.version) {
            lines.push(`  version: ${config.version}`);
        }
        
        if (config.tasks && Array.isArray(config.tasks)) {
            for (const task of config.tasks) {
                lines.push(`  - label: ${task.label || 'unnamed'}`);
                lines.push(`    type: ${task.type || 'unknown'}`);
                if (task.command) lines.push(`    command: ${task.command}`);
                if (task.group) lines.push(`    group: ${typeof task.group === 'string' ? task.group : task.group.kind}`);
            }
        }

        return lines;
    }

    private transformExtensions(config: any): string[] {
        const lines: string[] = ['[recommended extensions]'];
        
        if (config.recommendations && Array.isArray(config.recommendations)) {
            for (const ext of config.recommendations) {
                lines.push(`  - ${ext}`);
            }
        }

        if (config.unwantedRecommendations && Array.isArray(config.unwantedRecommendations)) {
            lines.push('  [unwanted recommendations]');
            for (const ext of config.unwantedRecommendations) {
                lines.push(`    - ${ext}`);
            }
        }

        return lines;
    }

    private formatValue(value: any): string {
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'string') return value;
        return JSON.stringify(value);
    }
}

// ============================================================================
// LANGUAGE-SPECIFIC TRANSFORMERS
// ============================================================================

/**
 * Transformer for Python project files
 * Handles: requirements.txt, Pipfile, pyproject.toml
 */
class PythonTransformer implements JsonTransformer {
    canTransform(filePath: string): boolean {
        const basename = path.basename(filePath).toLowerCase();
        const ext = path.extname(filePath).toLowerCase();
        return basename === 'requirements.txt' || 
               basename === 'pipfile' || 
               (basename === 'pyproject.toml' && ext === '.toml');
    }

    transform(content: string, filePath: string): JsonTransformResult {
        const basename = path.basename(filePath).toLowerCase();

        if (basename === 'requirements.txt') {
            return this.transformRequirements(content, filePath);
        } else if (basename === 'pipfile') {
            return this.transformPipfile(content, filePath);
        } else if (basename === 'pyproject.toml') {
            return this.transformPyProject(content, filePath);
        }

        return this.fallback(content, filePath);
    }

    private transformRequirements(content: string, filePath: string): JsonTransformResult {
        const lines: string[] = ['# requirements.txt', '[dependencies]'];
        
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            // Parse package==version, package>=version, package~=version, etc.
            const match = trimmed.match(/^([a-zA-Z0-9_\-]+)\s*([<>=!~]+)?\s*([0-9a-zA-Z.*]+)?/);
            if (match) {
                const pkg = match[1];
                const op = match[2] || '';
                const version = match[3] || '*';
                lines.push(`  ${pkg}: ${op}${version}`);
            } else {
                lines.push(`  ${trimmed}`);
            }
        }

        const transformed = lines.join('\n');
        return this.createResult(content, transformed, filePath);
    }

    private transformPipfile(content: string, filePath: string): JsonTransformResult {
        try {
            const obj = parseToml(content);
            const lines: string[] = [`# Pipfile`];

            if (obj.packages) {
                lines.push('');
                lines.push('[packages]');
                for (const [pkg, version] of Object.entries(obj.packages)) {
                    lines.push(`  ${pkg}: ${typeof version === 'string' ? version : '*'}`);
                }
            }

            if (obj.dev_packages) {
                lines.push('');
                lines.push('[dev-packages]');
                for (const [pkg, version] of Object.entries(obj.dev_packages)) {
                    lines.push(`  ${pkg}: ${typeof version === 'string' ? version : '*'}`);
                }
            }

            if (obj.requires) {
                lines.push('');
                lines.push('[requires]');
                if (obj.requires.python_version) {
                    lines.push(`  python_version: ${obj.requires.python_version}`);
                }
                if (obj.requires.python_full_version) {
                    lines.push(`  python_full_version: ${obj.requires.python_full_version}`);
                }
            }

            const transformed = lines.join('\n');
            return this.createResult(content, transformed, filePath);
        } catch {
            return this.fallback(content, filePath);
        }
    }

    private transformPyProject(content: string, filePath: string): JsonTransformResult {
        try {
            const obj = parseToml(content);
            const lines: string[] = [`# pyproject.toml`];

            // Project metadata
            if (obj.project) {
                lines.push('');
                lines.push('[project]');
                const p = obj.project;
                if (p.name) lines.push(`  name: ${p.name}`);
                if (p.version) lines.push(`  version: ${p.version}`);
                if (p.description) lines.push(`  description: ${p.description}`);
                if (p.requires_python) lines.push(`  requires_python: ${p.requires_python}`);
                
                if (p.dependencies && Array.isArray(p.dependencies)) {
                    lines.push('');
                    lines.push('  [dependencies]');
                    for (const dep of p.dependencies) {
                        lines.push(`    ${dep}`);
                    }
                }
            }

            // Build system
            if (obj.build_system) {
                lines.push('');
                lines.push('[build-system]');
                if (obj.build_system.requires && Array.isArray(obj.build_system.requires)) {
                    lines.push('  requires:');
                    for (const req of obj.build_system.requires) {
                        lines.push(`    - ${req}`);
                    }
                }
                if (obj.build_system.build_backend) {
                    lines.push(`  build_backend: ${obj.build_system.build_backend}`);
                }
            }

            // Tool configurations
            const tools = Object.keys(obj).filter(k => k.startsWith('tool.'));
            if (tools.length > 0) {
                lines.push('');
                lines.push('[tools]');
                for (const tool of tools) {
                    lines.push(`  ${tool}: configured`);
                }
            }

            const transformed = lines.join('\n');
            return this.createResult(content, transformed, filePath);
        } catch {
            return this.fallback(content, filePath);
        }
    }

    private fallback(content: string, filePath: string): JsonTransformResult {
        return this.createResult(content, content, filePath, 0);
    }

    private createResult(original: string, transformed: string, filePath: string, minSavings: number = 40): JsonTransformResult {
        const originalTokens = TokenStats.estimateForFile(original, path.extname(filePath));
        const newTokens = TokenStats.estimateForFile(transformed, '.txt');
        const savings = originalTokens > 0
            ? Math.round((1 - newTokens / originalTokens) * 100)
            : 0;

        return {
            transformed,
            originalTokens,
            newTokens,
            savings: Math.max(minSavings, savings)
        };
    }
}

/**
 * Transformer for Rust project files
 * Handles: Cargo.toml, Cargo.lock
 */
class RustTransformer implements JsonTransformer {
    canTransform(filePath: string): boolean {
        const basename = path.basename(filePath).toLowerCase();
        return basename === 'cargo.toml' || basename === 'cargo.lock';
    }

    transform(content: string, filePath: string): JsonTransformResult {
        const basename = path.basename(filePath).toLowerCase();

        if (basename === 'cargo.toml') {
            return this.transformCargoToml(content, filePath);
        } else if (basename === 'cargo.lock') {
            return this.transformCargoLock(content, filePath);
        }

        return this.fallback(content, filePath);
    }

    private transformCargoToml(content: string, filePath: string): JsonTransformResult {
        try {
            const obj = parseToml(content);
            const lines: string[] = [`# Cargo.toml`];

            // Package metadata
            if (obj.package) {
                lines.push('');
                lines.push('[package]');
                const pkg = obj.package;
                if (pkg.name) lines.push(`  name: ${pkg.name}`);
                if (pkg.version) lines.push(`  version: ${pkg.version}`);
                if (pkg.edition) lines.push(`  edition: ${pkg.edition}`);
                if (pkg.authors && Array.isArray(pkg.authors)) {
                    lines.push(`  authors: ${pkg.authors.join(', ')}`);
                }
                if (pkg.description) lines.push(`  description: ${pkg.description}`);
                if (pkg.license) lines.push(`  license: ${pkg.license}`);
                if (pkg.repository) lines.push(`  repository: ${pkg.repository}`);
            }

            // Dependencies
            if (obj.dependencies) {
                lines.push('');
                lines.push('[dependencies]');
                for (const [dep, spec] of Object.entries(obj.dependencies)) {
                    if (typeof spec === 'string') {
                        lines.push(`  ${dep}: ${spec}`);
                    } else if (typeof spec === 'object') {
                        const depSpec = spec as any;
                        let depStr = '';
                        if (depSpec.version) depStr = depSpec.version;
                        if (depSpec.path) depStr += ` (path: ${depSpec.path})`;
                        if (depSpec.git) depStr += ` (git: ${depSpec.git})`;
                        if (depSpec.features) depStr += ` [features: ${depSpec.features.join(', ')}]`;
                        lines.push(`  ${dep}: ${depStr}`);
                    }
                }
            }

            // Dev dependencies
            if (obj.dev_dependencies) {
                lines.push('');
                lines.push('[dev-dependencies]');
                for (const [dep, spec] of Object.entries(obj.dev_dependencies)) {
                    lines.push(`  ${dep}: ${typeof spec === 'string' ? spec : 'configured'}`);
                }
            }

            // Build dependencies
            if (obj.build_dependencies) {
                lines.push('');
                lines.push('[build-dependencies]');
                for (const [dep, spec] of Object.entries(obj.build_dependencies)) {
                    lines.push(`  ${dep}: ${typeof spec === 'string' ? spec : 'configured'}`);
                }
            }

            const transformed = lines.join('\n');
            return this.createResult(content, transformed, filePath);
        } catch {
            return this.fallback(content, filePath);
        }
    }

    private transformCargoLock(content: string, filePath: string): JsonTransformResult {
        try {
            const obj = parseToml(content);
            const lines: string[] = [`# Cargo.lock`];

            if (obj.version) {
                lines.push(`lockfileVersion: ${obj.version}`);
            }

            // Package count
            if (obj.package && Array.isArray(obj.package)) {
                const pkgCount = obj.package.length;
                lines.push(`packages: ${pkgCount}`);

                // Show first 30 packages in detail
                lines.push('');
                lines.push('[packages]');
                const shown = obj.package.slice(0, 30);
                for (const pkg of shown) {
                    const pkgLine = `  ${pkg.name}@${pkg.version}`;
                    if (pkg.source) {
                        const source = pkg.source.replace('registry+', '').replace('git+', '');
                        lines.push(`${pkgLine} (${source})`);
                    } else {
                        lines.push(pkgLine);
                    }
                }

                if (pkgCount > 30) {
                    lines.push(`  ... and ${pkgCount - 30} more packages`);
                }

                // Dependencies summary
                const depsCount = obj.package.reduce((sum: number, pkg: any) => {
                    return sum + (pkg.dependencies ? pkg.dependencies.length : 0);
                }, 0);
                lines.push(``);
                lines.push(`total dependencies: ${depsCount}`);
            }

            const transformed = lines.join('\n');
            return this.createResult(content, transformed, filePath);
        } catch {
            return this.fallback(content, filePath);
        }
    }

    private fallback(content: string, filePath: string): JsonTransformResult {
        return this.createResult(content, content, filePath, 0);
    }

    private createResult(original: string, transformed: string, filePath: string, minSavings: number = 50): JsonTransformResult {
        const originalTokens = TokenStats.estimateForFile(original, path.extname(filePath));
        const newTokens = TokenStats.estimateForFile(transformed, '.txt');
        const savings = originalTokens > 0
            ? Math.round((1 - newTokens / originalTokens) * 100)
            : 0;

        return {
            transformed,
            originalTokens,
            newTokens,
            savings: Math.max(minSavings, savings)
        };
    }
}

/**
 * Transformer for Go project files
 * Handles: go.mod, go.sum
 */
class GoTransformer implements JsonTransformer {
    canTransform(filePath: string): boolean {
        const basename = path.basename(filePath).toLowerCase();
        return basename === 'go.mod' || basename === 'go.sum';
    }

    transform(content: string, filePath: string): JsonTransformResult {
        const basename = path.basename(filePath).toLowerCase();

        if (basename === 'go.mod') {
            return this.transformGoMod(content, filePath);
        } else if (basename === 'go.sum') {
            return this.transformGoSum(content, filePath);
        }

        return this.fallback(content, filePath);
    }

    private transformGoMod(content: string, filePath: string): JsonTransformResult {
        const lines: string[] = [`# go.mod`];
        const inBlock = { require: false, exclude: false, replace: false };

        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            
            // Module declaration
            if (trimmed.startsWith('module ')) {
                lines.push(`module: ${trimmed.replace('module ', '').trim()}`);
                continue;
            }

            // Go version
            if (trimmed.startsWith('go ')) {
                lines.push(`go: ${trimmed.replace('go ', '').trim()}`);
                continue;
            }

            // Toolchain
            if (trimmed.startsWith('toolchain ')) {
                lines.push(`toolchain: ${trimmed.replace('toolchain ', '').trim()}`);
                continue;
            }

            // Block start
            if (trimmed.startsWith('require (')) {
                inBlock.require = true;
                lines.push('');
                lines.push('[require]');
                continue;
            }
            if (trimmed.startsWith('exclude (')) {
                inBlock.require = false;
                inBlock.exclude = true;
                lines.push('');
                lines.push('[exclude]');
                continue;
            }
            if (trimmed.startsWith('replace (')) {
                inBlock.exclude = false;
                inBlock.replace = true;
                lines.push('');
                lines.push('[replace]');
                continue;
            }

            // Block end
            if (trimmed === ')') {
                inBlock.require = false;
                inBlock.exclude = false;
                inBlock.replace = false;
                continue;
            }

            // Single-line statements
            if (trimmed.startsWith('require ')) {
                const parts = trimmed.replace('require ', '').trim().split(/\s+/);
                lines.push(`  ${parts[0]}: ${parts[1] || '*'}`);
                continue;
            }
            if (trimmed.startsWith('exclude ')) {
                const parts = trimmed.replace('exclude ', '').trim().split(/\s+/);
                lines.push(`  ${parts[0]}: ${parts[1] || '*'}`);
                continue;
            }
            if (trimmed.startsWith('replace ')) {
                const parts = trimmed.replace('replace ', '').trim().split('=>');
                if (parts.length === 2) {
                    lines.push(`  ${parts[0].trim()}: ${parts[1].trim()}`);
                }
                continue;
            }

            // Inside blocks
            if (inBlock.require || inBlock.exclude || inBlock.replace) {
                if (trimmed && !trimmed.startsWith('//')) {
                    const parts = trimmed.split(/\s+/);
                    if (parts.length >= 2) {
                        lines.push(`  ${parts[0]}: ${parts[1]}`);
                    } else if (parts.length === 1) {
                        lines.push(`  ${parts[0]}`);
                    }
                }
            }
        }

        const transformed = lines.join('\n');
        return this.createResult(content, transformed, filePath);
    }

    private transformGoSum(content: string, filePath: string): JsonTransformResult {
        // go.sum is large - just show summary
        const goSumLines = content.split('\n').filter(l => l.trim());
        const moduleSet = new Set<string>();

        for (const line of goSumLines) {
            const parts = line.split(' ');
            if (parts.length >= 2) {
                moduleSet.add(parts[0]);
            }
        }

        const lines: string[] = [
            `# go.sum`,
            `modules: ${moduleSet.size}`,
            ``,
            '[modules]'
        ];

        // Show first 50 modules
        const modules = Array.from(moduleSet).sort().slice(0, 50);
        for (const mod of modules) {
            lines.push(`  ${mod}`);
        }

        if (moduleSet.size > 50) {
            lines.push(`  ... and ${moduleSet.size - 50} more modules`);
        }

        const transformed = lines.join('\n');
        return this.createResult(content, transformed, filePath, 80);
    }

    private fallback(content: string, filePath: string): JsonTransformResult {
        return this.createResult(content, content, filePath, 0);
    }

    private createResult(original: string, transformed: string, filePath: string, minSavings: number = 60): JsonTransformResult {
        const originalTokens = TokenStats.estimateForFile(original, path.extname(filePath));
        const newTokens = TokenStats.estimateForFile(transformed, '.txt');
        const savings = originalTokens > 0
            ? Math.round((1 - newTokens / originalTokens) * 100)
            : 0;

        return {
            transformed,
            originalTokens,
            newTokens,
            savings: Math.max(minSavings, savings)
        };
    }
}

/**
 * Transformer for PHP project files
 * Handles: composer.json, composer.lock
 */
class PhpTransformer implements JsonTransformer {
    canTransform(filePath: string): boolean {
        const basename = path.basename(filePath).toLowerCase();
        return basename === 'composer.json' || basename === 'composer.lock';
    }

    transform(content: string, filePath: string): JsonTransformResult {
        const basename = path.basename(filePath).toLowerCase();

        if (basename === 'composer.json') {
            return this.transformComposerJson(content, filePath);
        } else if (basename === 'composer.lock') {
            return this.transformComposerLock(content, filePath);
        }

        return this.fallback(content, filePath);
    }

    private transformComposerJson(content: string, filePath: string): JsonTransformResult {
        try {
            const obj = JSON.parse(content);
            const lines: string[] = [`# composer.json`];

            // Package info
            if (obj.name) lines.push(`name: ${obj.name}`);
            if (obj.description) lines.push(`description: ${obj.description}`);
            if (obj.type) lines.push(`type: ${obj.type}`);
            if (obj.license) lines.push(`license: ${obj.license}`);
            if (obj.version) lines.push(`version: ${obj.version}`);

            // Authors
            if (obj.authors && Array.isArray(obj.authors)) {
                lines.push('');
                lines.push('[authors]');
                for (const author of obj.authors) {
                    const authorStr = author.name + (author.email ? ` <${author.email}>` : '');
                    lines.push(`  ${authorStr}`);
                }
            }

            // Requirements
            if (obj.require) {
                lines.push('');
                lines.push('[require]');
                for (const [pkg, version] of Object.entries(obj.require)) {
                    lines.push(`  ${pkg}: ${version}`);
                }
            }

            // Require-dev
            if (obj.require_dev) {
                lines.push('');
                lines.push('[require-dev]');
                for (const [pkg, version] of Object.entries(obj.require_dev)) {
                    lines.push(`  ${pkg}: ${version}`);
                }
            }

            // Autoload
            if (obj.autoload) {
                lines.push('');
                lines.push('[autoload]');
                if (obj.autoload.psr4) {
                    lines.push('  [psr4]');
                    for (const [ns, path] of Object.entries(obj.autoload.psr4)) {
                        lines.push(`    ${ns}: ${path}`);
                    }
                }
                if (obj.autoload.classmap && Array.isArray(obj.autoload.classmap)) {
                    lines.push(`  classmap: ${obj.autoload.classmap.join(', ')}`);
                }
            }

            // Scripts
            if (obj.scripts) {
                lines.push('');
                lines.push('[scripts]');
                for (const [event, commands] of Object.entries(obj.scripts)) {
                    const cmds = Array.isArray(commands) ? commands.join('; ') : commands;
                    lines.push(`  ${event}: ${cmds}`);
                }
            }

            const transformed = lines.join('\n');
            return this.createResult(content, transformed, filePath);
        } catch {
            return this.fallback(content, filePath);
        }
    }

    private transformComposerLock(content: string, filePath: string): JsonTransformResult {
        try {
            const obj = JSON.parse(content);
            const lines: string[] = [`# composer.lock`];

            if (obj._readme) lines.push(`readme: ${obj._readme}`);
            if (obj.content_hash) lines.push(`content_hash: ${obj.content_hash.substring(0, 16)}...`);

            // Packages summary
            if (obj.packages && Array.isArray(obj.packages)) {
                const pkgCount = obj.packages.length;
                lines.push(``);
                lines.push(`[packages]`);
                lines.push(`total: ${pkgCount}`);

                // Show first 30 packages
                const shown = obj.packages.slice(0, 30);
                for (const pkg of shown) {
                    lines.push(`  ${pkg.name}@${pkg.version}`);
                }

                if (pkgCount > 30) {
                    lines.push(`  ... and ${pkgCount - 30} more packages`);
                }
            }

            // Dev packages
            if (obj.packages_dev && Array.isArray(obj.packages_dev)) {
                const pkgCount = obj.packages_dev.length;
                lines.push(``);
                lines.push(`[packages-dev]`);
                lines.push(`total: ${pkgCount}`);

                const shown = obj.packages_dev.slice(0, 20);
                for (const pkg of shown) {
                    lines.push(`  ${pkg.name}@${pkg.version}`);
                }

                if (pkgCount > 20) {
                    lines.push(`  ... and ${pkgCount - 20} more packages`);
                }
            }

            // Platform
            if (obj.platform && Object.keys(obj.platform).length > 0) {
                lines.push(``);
                lines.push(`[platform]`);
                for (const [pkg, version] of Object.entries(obj.platform)) {
                    lines.push(`  ${pkg}: ${version}`);
                }
            }

            const transformed = lines.join('\n');
            return this.createResult(content, transformed, filePath);
        } catch {
            return this.fallback(content, filePath);
        }
    }

    private fallback(content: string, filePath: string): JsonTransformResult {
        return this.createResult(content, content, filePath, 0);
    }

    private createResult(original: string, transformed: string, filePath: string, minSavings: number = 50): JsonTransformResult {
        const originalTokens = TokenStats.estimateForFile(original, path.extname(filePath));
        const newTokens = TokenStats.estimateForFile(transformed, '.txt');
        const savings = originalTokens > 0
            ? Math.round((1 - newTokens / originalTokens) * 100)
            : 0;

        return {
            transformed,
            originalTokens,
            newTokens,
            savings: Math.max(minSavings, savings)
        };
    }
}

/**
 * Transformer for Ruby project files
 * Handles: Gemfile, Gemfile.lock
 */
class RubyTransformer implements JsonTransformer {
    canTransform(filePath: string): boolean {
        const basename = path.basename(filePath).toLowerCase();
        return basename === 'gemfile' || basename === 'gemfile.lock';
    }

    transform(content: string, filePath: string): JsonTransformResult {
        const basename = path.basename(filePath).toLowerCase();

        if (basename === 'gemfile') {
            return this.transformGemfile(content, filePath);
        } else if (basename === 'gemfile.lock') {
            return this.transformGemfileLock(content, filePath);
        }

        return this.fallback(content, filePath);
    }

    private transformGemfile(content: string, filePath: string): JsonTransformResult {
        const lines: string[] = [`# Gemfile`];
        const gems: string[] = [];
        const sources: string[] = [];
        const rubyVersion: string[] = [];
        const groups: Record<string, string[]> = {};
        let currentGroup: string | null = null;

        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            // Source
            const sourceMatch = trimmed.match(/^source\s+['"]([^'"]+)['"]/);
            if (sourceMatch) {
                sources.push(sourceMatch[1]);
                continue;
            }

            // Ruby version
            const rubyMatch = trimmed.match(/^ruby\s+['"]([^'"]+)['"]/);
            if (rubyMatch) {
                rubyVersion.push(rubyMatch[1]);
                continue;
            }

            // Group start
            const groupMatch = trimmed.match(/^group\s+([:\w,\s]+)\s+do/);
            if (groupMatch) {
                const groupNames = groupMatch[1].split(',').map(g => g.trim().replace(':', ''));
                currentGroup = groupNames.join(', ');
                groups[currentGroup] = [];
                continue;
            }

            // Group end
            if (trimmed === 'end') {
                currentGroup = null;
                continue;
            }

            // Gem declaration
            const gemMatch = trimmed.match(/^gem\s+['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])?(?:\s*,\s*(.+))?/);
            if (gemMatch) {
                const gemName = gemMatch[1];
                const version = gemMatch[2] || '*';
                const options = gemMatch[3] || '';
                const gemStr = `${gemName}: ${version}${options ? ` (${options})` : ''}`;

                if (currentGroup) {
                    groups[currentGroup].push(gemStr);
                } else {
                    gems.push(gemStr);
                }
            }
        }

        // Output
        if (sources.length > 0) {
            lines.push('');
            lines.push('[sources]');
            for (const source of sources) {
                lines.push(`  ${source}`);
            }
        }

        if (rubyVersion.length > 0) {
            lines.push('');
            lines.push('[ruby]');
            for (const version of rubyVersion) {
                lines.push(`  ${version}`);
            }
        }

        if (gems.length > 0) {
            lines.push('');
            lines.push('[gems]');
            for (const gem of gems) {
                lines.push(`  ${gem}`);
            }
        }

        if (Object.keys(groups).length > 0) {
            lines.push('');
            lines.push('[groups]');
            for (const [groupName, groupGems] of Object.entries(groups)) {
                lines.push(`  [${groupName}]`);
                for (const gem of groupGems) {
                    lines.push(`    ${gem}`);
                }
            }
        }

        const transformed = lines.join('\n');
        return this.createResult(content, transformed, filePath);
    }

    private transformGemfileLock(content: string, filePath: string): JsonTransformResult {
        const lines: string[] = [`# Gemfile.lock`];
        const sections: Record<string, string[]> = {};
        let currentSection: string | null = null;

        for (const line of content.split('\n')) {
            // Section header (no leading spaces, ends with :)
            if (/^[A-Z][\w\s]+:$/.test(line.trim())) {
                currentSection = line.trim().replace(':', '');
                sections[currentSection] = [];
                continue;
            }

            // Gem entry (2 spaces, name and version)
            if (currentSection && line.startsWith('  ') && !line.startsWith('    ')) {
                const gemMatch = line.trim().match(/^([^(\s]+)\s+\(([^)]+)\)/);
                if (gemMatch) {
                    sections[currentSection].push(`${gemMatch[1]}: ${gemMatch[2]}`);
                }
            }
        }

        // Output
        for (const [section, gems] of Object.entries(sections)) {
            lines.push('');
            lines.push(`[${section}]`);
            lines.push(`total: ${gems.length}`);
            
            // Show first 30 gems per section
            const shown = gems.slice(0, 30);
            for (const gem of shown) {
                lines.push(`  ${gem}`);
            }

            if (gems.length > 30) {
                lines.push(`  ... and ${gems.length - 30} more`);
            }
        }

        // GEM SPECS section (detailed info) - just show count
        if (sections['specs']) {
            lines.push('');
            lines.push(`[specs]`);
            lines.push(`total gem specifications: ${sections['specs'].length}`);
        }

        const transformed = lines.join('\n');
        return this.createResult(content, transformed, filePath, 70);
    }

    private fallback(content: string, filePath: string): JsonTransformResult {
        return this.createResult(content, content, filePath, 0);
    }

    private createResult(original: string, transformed: string, filePath: string, minSavings: number = 50): JsonTransformResult {
        const originalTokens = TokenStats.estimateForFile(original, path.extname(filePath));
        const newTokens = TokenStats.estimateForFile(transformed, '.txt');
        const savings = originalTokens > 0
            ? Math.round((1 - newTokens / originalTokens) * 100)
            : 0;

        return {
            transformed,
            originalTokens,
            newTokens,
            savings: Math.max(minSavings, savings)
        };
    }
}
