import * as path from 'path';
import * as fs from 'fs';
import { TokenStats } from './tokenStats';

/**
 * Column information for a database table
 */
export interface ColumnInfo {
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
    defaultValue?: string;
    unique?: boolean;
}

/**
 * Foreign key information
 */
export interface ForeignKeyInfo {
    column: string;
    referencesTable: string;
    referencesColumn: string;
}

/**
 * Index information
 */
export interface IndexInfo {
    name: string;
    columns: string[];
    unique: boolean;
}

/**
 * Table schema information
 */
export interface TableSchema {
    name: string;
    columns: ColumnInfo[];
    indexes: IndexInfo[];
    foreignKeys: ForeignKeyInfo[];
}

/**
 * Result of database extraction
 */
export interface DbExtractResult {
    transformed: string;      // SQL + Mermaid ER diagram
    tables: TableSchema[];
    tokenCount: number;
}

/**
 * Database Schema Extractor
 * Supports: SQLite files, SQL migration files
 */
export class DatabaseExtractor {
    /**
     * Check if file is a database file
     */
    isDatabaseFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return ['.db', '.sqlite', '.sqlite3', '.db3'].includes(ext);
    }

    /**
     * Check if file is a SQL migration file
     */
    isMigrationFile(filePath: string): boolean {
        const basename = path.basename(filePath).toLowerCase();
        const ext = path.extname(filePath).toLowerCase();
        return ext === '.sql' && (
            basename.includes('migration') ||
            basename.includes('migrate') ||
            basename.includes('schema') ||
            basename.includes('create') ||
            filePath.includes('/migrations/') ||
            filePath.includes('/migrate/')
        );
    }

    /**
     * Extract schema from SQLite database file
     */
    async extractSqlite(dbPath: string): Promise<DbExtractResult> {
        const tables: TableSchema[] = [];
        
        try {
            // Read SQLite file as buffer
            const buffer = fs.readFileSync(dbPath);
            
            // Check SQLite header: "SQLite format 3\0" (16 bytes)
            if (!this.isValidSqliteHeader(buffer)) {
                return this.createEmptyResult('Invalid SQLite file');
            }

            // Parse SQLite using simple approach
            // Note: For production, use better-sqlite3 or sql.js
            // Here we'll extract what we can from the raw file
            
            const schema = await this.parseSqliteSchema(buffer);
            tables.push(...schema);

            const transformed = this.formatSchema(tables, dbPath);
            const tokenCount = TokenStats.estimate(transformed);

            return {
                transformed,
                tables,
                tokenCount
            };
        } catch (e) {
            return this.createEmptyResult(`Error reading SQLite: ${String(e)}`);
        }
    }

    /**
     * Validate SQLite file header
     */
    private isValidSqliteHeader(buffer: Buffer): boolean {
        const header = 'SQLite format 3';
        for (let i = 0; i < header.length; i++) {
            if (buffer[i] !== header.charCodeAt(i)) {
                return false;
            }
        }
        return buffer[15] === 0;
    }

    /**
     * Parse SQLite schema from raw buffer
     * This is a simplified parser - extracts table names and basic info
     */
    private async parseSqliteSchema(buffer: Buffer): Promise<TableSchema[]> {
        const tables: TableSchema[] = [];
        
        // SQLite stores schema in sqlite_master table
        // We'll look for CREATE TABLE statements in the file
        
        const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 100000));
        
        // Find CREATE TABLE statements
        const createTableRegex = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["']?(\w+)["']?\s*\(([^;]+)\)/gi;
        let match: RegExpExecArray | null;
        
        while ((match = createTableRegex.exec(content)) !== null) {
            const tableName = match[1];
            const columnsDef = match[2];
            
            const table: TableSchema = {
                name: tableName,
                columns: this.parseColumns(columnsDef),
                indexes: [],
                foreignKeys: this.parseForeignKeys(columnsDef)
            };
            
            tables.push(table);
        }

        // Find CREATE INDEX statements
        const createIndexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?["']?(\w+)["']?\s+ON\s+["']?(\w+)["']?\s*\(([^)]+)\)/gi;
        while ((match = createIndexRegex.exec(content)) !== null) {
            const indexName = match[1];
            const tableName = match[2];
            const columns = match[3].split(',').map(c => c.trim().replace(/["']/g, ''));
            
            const table = tables.find(t => t.name === tableName);
            if (table) {
                table.indexes.push({
                    name: indexName,
                    columns,
                    unique: match[0].toUpperCase().includes('UNIQUE')
                });
            }
        }

        return tables;
    }

    /**
     * Parse column definitions from CREATE TABLE body
     */
    private parseColumns(columnsDef: string): ColumnInfo[] {
        const columns: ColumnInfo[] = [];
        
        // Split by comma, but respect parentheses
        const parts = this.splitRespectingParens(columnsDef);
        
        for (const part of parts) {
            const trimmed = part.trim();
            
            // Skip constraints
            if (/^(PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK|CONSTRAINT)/i.test(trimmed)) {
                continue;
            }
            
            const column = this.parseColumn(trimmed);
            if (column) {
                columns.push(column);
            }
        }
        
        return columns;
    }

    /**
     * Parse single column definition
     */
    private parseColumn(def: string): ColumnInfo | null {
        const parts = def.trim().split(/\s+/);
        if (parts.length < 2) return null;
        
        const name = parts[0].replace(/["'`]/g, '');
        const type = parts[1].toUpperCase();
        
        const rest = def.substring(parts[0].length + parts[1].length + 2).toUpperCase();
        
        return {
            name,
            type,
            nullable: !rest.includes('NOT NULL'),
            primaryKey: rest.includes('PRIMARY KEY'),
            defaultValue: this.extractDefaultValue(def)
        };
    }

    /**
     * Parse foreign keys from column definitions
     */
    private parseForeignKeys(columnsDef: string): ForeignKeyInfo[] {
        const fks: ForeignKeyInfo[] = [];
        
        // Match FOREIGN KEY (col) REFERENCES table(col)
        const fkRegex = /FOREIGN KEY\s*\((\w+)\)\s*REFERENCES\s+(\w+)\s*\((\w+)\)/gi;
        let match: RegExpExecArray | null;
        
        while ((match = fkRegex.exec(columnsDef)) !== null) {
            fks.push({
                column: match[1],
                referencesTable: match[2],
                referencesColumn: match[3]
            });
        }
        
        return fks;
    }

    /**
     * Extract default value from column definition
     */
    private extractDefaultValue(def: string): string | undefined {
        const match = def.match(/DEFAULT\s+([^,\s]+|'[^']*'|"[^"]*"|\([^)]+\))/i);
        return match ? match[1] : undefined;
    }

    /**
     * Split string by comma, respecting parentheses
     */
    private splitRespectingParens(str: string): string[] {
        const parts: string[] = [];
        let current = '';
        let depth = 0;
        
        for (const char of str) {
            if (char === '(') depth++;
            else if (char === ')') depth--;
            else if (char === ',' && depth === 0) {
                parts.push(current);
                current = '';
                continue;
            }
            current += char;
        }
        
        if (current) parts.push(current);
        return parts;
    }

    /**
     * Parse Prisma schema file
     * EA-06.2: Extract models from schema.prisma
     */
    async extractFromPrisma(prismaPath: string): Promise<DbExtractResult> {
        try {
            const content = fs.readFileSync(prismaPath, 'utf-8');
            const tables: TableSchema[] = [];

            // Parse model blocks
            const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
            let modelMatch: RegExpExecArray | null;

            while ((modelMatch = modelRegex.exec(content)) !== null) {
                const modelName = modelMatch[1];
                const modelBody = modelMatch[2];
                const table: TableSchema = {
                    name: modelName,
                    columns: this.parsePrismaFields(modelBody),
                    indexes: [],
                    foreignKeys: this.parsePrismaRelations(modelBody, modelName)
                };
                tables.push(table);
            }

            const transformed = this.formatSchema(tables, `Prisma: ${path.basename(prismaPath)}`);
            const tokenCount = TokenStats.estimate(transformed);

            return {
                transformed,
                tables,
                tokenCount
            };
        } catch (e) {
            return this.createEmptyResult(`Error parsing Prisma schema: ${String(e)}`);
        }
    }

    /**
     * Parse Prisma model fields
     */
    private parsePrismaFields(body: string): ColumnInfo[] {
        const columns: ColumnInfo[] = [];
        const lines = body.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

            // Parse field: name Type @attributes
            const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(?:\?)?(?:\[(?:\d+)\])?\s*(.*)/);
            if (fieldMatch) {
                const name = fieldMatch[1];
                const type = this.mapPrismaType(fieldMatch[2]);
                const attributes = fieldMatch[3] || '';

                const column: ColumnInfo = {
                    name,
                    type,
                    nullable: trimmed.includes('?'),
                    primaryKey: attributes.includes('@id'),
                    unique: attributes.includes('@unique'),
                    defaultValue: this.extractPrismaDefault(attributes)
                };

                columns.push(column);
            }
        }

        return columns;
    }

    /**
     * Map Prisma types to SQL types
     */
    private mapPrismaType(prismaType: string): string {
        const typeMap: Record<string, string> = {
            'String': 'VARCHAR',
            'Int': 'INTEGER',
            'BigInt': 'BIGINT',
            'Float': 'DECIMAL',
            'Decimal': 'DECIMAL',
            'Boolean': 'BOOLEAN',
            'DateTime': 'TIMESTAMP',
            'Json': 'JSON',
            'Bytes': 'BLOB',
            'Xml': 'XML'
        };
        return typeMap[prismaType] || prismaType.toUpperCase();
    }

    /**
     * Extract default value from Prisma attributes
     */
    private extractPrismaDefault(attributes: string): string | undefined {
        const defaultMatch = attributes.match(/@default\(([^)]+)\)/);
        if (defaultMatch) {
            return defaultMatch[1];
        }
        return undefined;
    }

    /**
     * Parse Prisma relations (foreign keys)
     */
    private parsePrismaRelations(body: string, modelName: string): ForeignKeyInfo[] {
        const fks: ForeignKeyInfo[] = [];
        const lines = body.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//')) continue;

            // Parse relation: field Type @relation(fields: [...], references: [...])
            const relationMatch = trimmed.match(/(\w+)\s+\w+\s+@relation\([^)]*references:\s*\[([^\]]+)\][^)]*\)/);
            if (relationMatch) {
                const field = relationMatch[1];
                const references = relationMatch[2].replace(/"/g, '').trim();

                // Extract target table from type
                const typeMatch = trimmed.match(/(\w+)\??/);
                if (typeMatch && typeMatch[1]) {
                    fks.push({
                        column: field,
                        referencesTable: typeMatch[1],
                        referencesColumn: references
                    });
                }
            }
        }

        return fks;
    }

    /**
     * Extract schema from SQL migration files (improved)
     * EA-06.1: Better parsing for CREATE TABLE, ALTER TABLE, indexes
     */
    async extractFromMigrations(sqlFiles: string[]): Promise<DbExtractResult> {
        const tables: TableSchema[] = [];
        const allStatements: string[] = [];

        for (const sqlFile of sqlFiles) {
            try {
                const content = fs.readFileSync(sqlFile, 'utf-8');
                allStatements.push(`-- File: ${path.basename(sqlFile)}\n${content}`);
            } catch (e) {
                console.error(`Error reading ${sqlFile}:`, e);
            }
        }

        const fullContent = allStatements.join('\n\n');

        // Parse CREATE TABLE statements
        const createTableRegex = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["']?(\w+)["']?\s*\(([^;]+)\)/gi;
        let match: RegExpExecArray | null;

        while ((match = createTableRegex.exec(fullContent)) !== null) {
            const tableName = match[1];
            const columnsDef = match[2];

            // Skip if table already exists
            if (tables.some(t => t.name === tableName)) {
                continue;
            }

            const table: TableSchema = {
                name: tableName,
                columns: this.parseColumns(columnsDef),
                indexes: this.parseCreateIndexStatements(fullContent, tableName),
                foreignKeys: this.parseForeignKeys(columnsDef)
            };

            tables.push(table);
        }

        // Parse ALTER TABLE ADD COLUMN
        const alterTableRegex = /ALTER TABLE\s+(\w+)\s+ADD (?:COLUMN\s+)?(\w+)\s+([^;]+)/gi;
        while ((match = alterTableRegex.exec(fullContent)) !== null) {
            const tableName = match[1];
            const columnName = match[2];
            const columnDef = match[3];

            const table = tables.find(t => t.name === tableName);
            if (table && !table.columns.some(c => c.name === columnName)) {
                table.columns.push(this.parseSingleColumn(columnName, columnDef));
            }
        }

        const transformed = this.formatSchema(tables, 'Migrations');
        const tokenCount = TokenStats.estimate(transformed);

        return {
            transformed,
            tables,
            tokenCount
        };
    }

    /**
     * Parse CREATE INDEX statements
     */
    private parseCreateIndexStatements(content: string, tableName: string): IndexInfo[] {
        const indexes: IndexInfo[] = [];
        const indexRegex = /CREATE (?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?(\w+)\s+ON\s+["']?(\w+)["']?\s*\(([^)]+)\)/gi;
        let match: RegExpExecArray | null;

        while ((match = indexRegex.exec(content)) !== null) {
            const indexName = match[1];
            const indexTable = match[2];
            const columns = match[3].split(',').map(c => c.trim().replace(/["']/g, ''));

            if (indexTable === tableName) {
                const fullMatch = match[0];
                indexes.push({
                    name: indexName,
                    columns,
                    unique: fullMatch.toUpperCase().includes('UNIQUE')
                });
            }
        }

        return indexes;
    }

    /**
     * Parse single column definition (for ALTER TABLE)
     */
    private parseSingleColumn(name: string, def: string): ColumnInfo {
        const parts = def.trim().split(/\s+/);
        const type = parts[0].toUpperCase();
        const rest = def.toUpperCase();

        return {
            name,
            type,
            nullable: !rest.includes('NOT NULL'),
            primaryKey: rest.includes('PRIMARY KEY'),
            unique: rest.includes('UNIQUE'),
            defaultValue: this.extractDefaultValue(def)
        };
    }

    /**
     * Format schema as SQL + Mermaid ER diagram
     */
    private formatSchema(tables: TableSchema[], source: string): string {
        const lines: string[] = [
            `-- Database Schema from: ${source}`,
            `-- Tables: ${tables.length}`,
            ''
        ];

        // SQL Schema
        for (const table of tables) {
            lines.push(`[${table.name}]`);
            
            for (const col of table.columns) {
                let colDef = `  ${col.name} ${col.type}`;
                if (col.primaryKey) colDef += ' PRIMARY KEY';
                if (!col.nullable) colDef += ' NOT NULL';
                if (col.defaultValue) colDef += ` DEFAULT ${col.defaultValue}`;
                lines.push(colDef);
            }
            
            if (table.indexes.length > 0) {
                lines.push('  [indexes]');
                for (const idx of table.indexes) {
                    lines.push(`    ${idx.name}: (${idx.columns.join(', ')})${idx.unique ? ' UNIQUE' : ''}`);
                }
            }
            
            if (table.foreignKeys.length > 0) {
                lines.push('  [foreign keys]');
                for (const fk of table.foreignKeys) {
                    lines.push(`    ${fk.column} → ${fk.referencesTable}(${fk.referencesColumn})`);
                }
            }
            
            lines.push('');
        }

        // Mermaid ER Diagram
        lines.push('---');
        lines.push('```mermaid');
        lines.push('erDiagram');
        
        for (const table of tables) {
            lines.push(`    ${table.name.toUpperCase()} {`);
            for (const col of table.columns) {
                const constraints = [];
                if (col.primaryKey) constraints.push('PK');
                if (!col.nullable) constraints.push('not null');
                if (col.defaultValue) constraints.push('default');
                const constraintStr = constraints.length > 0 ? ` ${constraints.join(', ')}` : '';
                lines.push(`        ${col.type} ${col.name}${constraintStr}`);
            }
            lines.push('    }');
        }
        
        // Relationships
        for (const table of tables) {
            for (const fk of table.foreignKeys) {
                lines.push(`    ${table.name.toUpperCase()} }|--|| ${fk.referencesTable.toUpperCase()} : "${fk.column} → ${fk.referencesColumn}"`);
            }
        }
        
        lines.push('```');

        return lines.join('\n');
    }

    /**
     * Create empty result with error message
     */
    private createEmptyResult(error: string): DbExtractResult {
        return {
            transformed: `-- ${error}`,
            tables: [],
            tokenCount: TokenStats.estimate(error)
        };
    }
}
