import * as vscode from 'vscode';
import * as path from 'path';
import { IgnoreEngine } from './ignoreEngine';

/**
 * File Intelligence Layer - Core Data Type
 * Semantic metadata for intent-driven filtering
 */
export type FileMeta = {
    uri: vscode.Uri;
    relativePath: string;
    ext: string;

    // Semantic flags
    isEntry: boolean;
    isConfig: boolean;
    isTest: boolean;
    isInterface: boolean;
    isBinary: boolean;
    isRootDoc: boolean;

    // Structural info
    depth: number;
    folder: string;

    // Dynamics (for Debug preset)
    lastModified?: number;
    sizeBytes: number;

    // Final score
    score: number;
};

/**
 * FileAnalyzer - Layer 1
 * Collects semantic metadata from files
 * 
 * This is the "brain" that turns "files" → "project understanding"
 */
export class FileAnalyzer {

    constructor(
        private rootPath: string,
        private ignoreEngine: IgnoreEngine
    ) {}

    /**
     * Analyze all files and build semantic metadata
     */
    public async analyze(files: vscode.Uri[]): Promise<FileMeta[]> {
        const result: FileMeta[] = [];

        for (const f of files) {
            const rel = path.relative(this.rootPath, f.fsPath).replace(/\\/g, '/');
            const ext = path.extname(f.fsPath).toLowerCase();
            const basename = path.basename(f.fsPath).toLowerCase();
            const basenameNoExt = basename.replace(/\.[^.]+$/, '');

            // Get file stat for modification time and size
            let stat: vscode.FileStat | undefined;
            try {
                stat = await vscode.workspace.fs.stat(f);
            } catch {
                // File may not exist or not accessible
            }

            result.push({
                uri: f,
                relativePath: rel,
                ext,

                // Semantic flags
                isEntry: this.isEntry(basenameNoExt, ext),
                isConfig: this.isConfig(basename, rel),
                isTest: this.isTest(basename, rel),
                isInterface: this.isInterface(basename, rel, ext),
                isBinary: this.ignoreEngine.isBinary(f.fsPath),
                isRootDoc: this.isRootDoc(basename, rel),

                // Structural info
                depth: rel.split('/').length,
                folder: path.dirname(rel),

                // Dynamics
                lastModified: stat?.mtime,
                sizeBytes: stat?.size ?? 0,

                // Score (initialized to 0)
                score: 0
            });
        }

        return result;
    }

    // ============================================================================
    // SEMANTIC HEURISTICS (extensible)
    // ============================================================================

    /**
     * Check if file is an entry point
     */
    private isEntry(basenameNoExt: string, ext: string): boolean {
        const entryPointNames = [
            'index', 'main', 'app', 'entry', 'start', 'init',
            '__main__', 'cli', 'server', 'client', 'program', 'bootstrap'
        ];
        const sourceExts = [
            '.ts', '.js', '.tsx', '.jsx', '.py', '.rs', '.go', '.php',
            '.rb', '.java', '.cs', '.fs', '.vb', '.dart', '.swift', '.kt', '.scala'
        ];
        return entryPointNames.includes(basenameNoExt) && sourceExts.includes(ext);
    }

    /**
     * Check if file is a config file
     */
    private isConfig(basename: string, rel: string): boolean {
        const configFiles = [
            'package.json', 'requirements.txt', 'pyproject.toml', 'pipfile',
            'cargo.toml', 'cargo.lock', 'go.mod', 'go.sum',
            'composer.json', 'gemfile', 'pubspec.yaml',
            'pom.xml', 'build.gradle', 'settings.gradle',
            'tsconfig.json', 'jsconfig.json',
            'dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
            '.eslintrc', '.prettierrc', '.gitignore',
            'webpack.config.js', 'vite.config.ts', 'rollup.config.js',
            '.env', '.env.local', '.env.production'
        ];
        
        // Exact match for config files
        if (configFiles.some(cf => basename === cf.toLowerCase())) {
            return true;
        }

        // Pattern match for config files in root
        if (rel.split('/').length <= 2) {
            if (/^\.env\./i.test(basename)) return true;
            if (/\.config\.(js|ts|mjs|cjs)$/i.test(basename)) return true;
        }

        return false;
    }

    /**
     * Check if file is a test file
     */
    private isTest(basename: string, rel: string): boolean {
        const testPatterns = [
            '.test.', '.spec.', '.story.', '.stories.'
        ];
        const testFolders = [
            '__tests__', '__mocks__', '/test/', '/tests/', '/spec/'
        ];

        if (testPatterns.some(p => basename.includes(p))) {
            return true;
        }

        if (testFolders.some(f => rel.toLowerCase().includes(f))) {
            return true;
        }

        return false;
    }

    /**
     * Check if file is an interface/type definition
     */
    private isInterface(basename: string, rel: string, ext: string): boolean {
        // TypeScript declaration files
        if (ext === '.d.ts') return true;

        // Interface/type files by name
        const interfacePatterns = ['.interface.', '.types.', '.type.'];
        if (interfacePatterns.some(p => basename.includes(p))) {
            return true;
        }

        // Interface/type folders
        const interfaceFolders = ['/interfaces/', '/types/', '/models/'];
        if (interfaceFolders.some(f => rel.toLowerCase().includes(f))) {
            return true;
        }

        // C/C++ headers
        const headerExts = ['.h', '.hpp', '.hxx', '.h++'];
        if (headerExts.includes(ext)) return true;

        // OCaml interfaces
        if (['.ml', '.mli', '.sig'].includes(ext)) return true;

        // ABI definitions
        if (ext === '.abi') return true;

        return false;
    }

    /**
     * Check if file is a root-level documentation file
     */
    private isRootDoc(basename: string, rel: string): boolean {
        // Must be in root directory (depth <= 2)
        if (rel.split('/').length > 2) return false;

        const docFiles = [
            'readme.md', 'readme.txt', 'readme.rst',
            'changelog.md', 'changes.md', 'news.md',
            'license', 'license.md', 'license.txt',
            'contributing.md', 'contributors.md',
            'authors.md', 'notice.md', 'acknowledgments.md'
        ];

        return docFiles.includes(basename.toLowerCase());
    }
}
