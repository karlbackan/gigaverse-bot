#!/usr/bin/env node
/**
 * Initialize the battle statistics database
 * Creates tables and sets up the database schema
 */

import { getDatabase } from '../src/database.mjs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'battle-statistics.db');

console.log('🗄️  Initializing battle statistics database...');
console.log(`📁 Database location: ${dbPath}`);

try {
    const db = getDatabase(dbPath);
    await db.initialize();
    
    // Test basic operations
    console.log('🔍 Testing database operations...');
    
    // Check tables
    const tables = await db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    `);
    
    console.log(`📊 Created ${tables.length} tables:`);
    tables.forEach(table => console.log(`  - ${table.name}`));
    
    // Check views
    const views = await db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='view'
        ORDER BY name
    `);
    
    console.log(`👁️  Created ${views.length} views:`);
    views.forEach(view => console.log(`  - ${view.name}`));
    
    // Test metadata
    const metadata = await db.all(`SELECT * FROM metadata`);
    console.log('📋 Metadata:');
    metadata.forEach(meta => console.log(`  ${meta.key}: ${meta.value}`));
    
    // Test summary view
    const summary = await db.get(`SELECT * FROM battle_summary`);
    console.log('📈 Initial battle summary:', summary);
    
    console.log('');
    console.log('✅ Database initialization completed successfully!');
    console.log('📊 Ready to migrate data from battle-statistics.json');
    
    await db.close();
    
} catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
}