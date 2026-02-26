const fs = require('fs');
const path = require('path');
const dir = 'd:/DEV/ADBloater/src/locales';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'index.ts');

files.filter(f => f !== 'en.ts').forEach(file => {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const lines = content.split('\n');
    const matches = [];
    const lang = file.replace('.ts', '');
    const nonLatinLangs = ['zh', 'ja', 'ar', 'hi', 'bn', 'ru'];
    const isNonLatin = nonLatinLangs.includes(lang);

    lines.forEach((line, i) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
        const match = line.match(/^\s+(\w+):\s*['"](.+?)['"],?\s*$/);
        if (match) {
            const key = match[1];
            const value = match[2];

            // Skip keys that are naturally English (URLs, versions, technical values)
            if (['version', 'footer', 'appName'].includes(key)) return;
            if (value.startsWith('http') || value.startsWith('v1.')) return;

            if (isNonLatin) {
                // For non-Latin langs, flag pure ASCII multi-word values
                if (/^[A-Za-z0-9\s.,!?&()\-:;\/'"]+$/.test(value) && value.includes(' ') && value.length > 10) {
                    matches.push({ line: i + 1, key, value: value.substring(0, 80) });
                }
            } else {
                // For Latin langs (it, es, de, fr, pt-BR, id), compare with English patterns
                // This is trickier - we look for obviously English phrases
            }
        }
    });
    if (matches.length > 0) {
        console.log('\n=== ' + file + ' (' + matches.length + ' untranslated) ===');
        matches.forEach(m => console.log('  L' + m.line + ': ' + m.key + ' = "' + m.value + '"'));
    }
});

// Also check Latin-script languages by comparing with en.ts
const enContent = fs.readFileSync(path.join(dir, 'en.ts'), 'utf8');
const enLines = enContent.split('\n');
const enValues = {};
enLines.forEach((line) => {
    const match = line.match(/^\s+(\w+):\s*['"](.+?)['"],?\s*$/);
    if (match) {
        enValues[match[1]] = match[2];
    }
});

const latinFiles = ['it.ts', 'es.ts', 'de.ts', 'fr.ts', 'pt-BR.ts', 'id.ts'];
latinFiles.forEach(file => {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const lines = content.split('\n');
    const matches = [];

    lines.forEach((line, i) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
        const match = line.match(/^\s+(\w+):\s*['"](.+?)['"],?\s*$/);
        if (match) {
            const key = match[1];
            const value = match[2];

            // Skip technical/invariant keys
            if (['version', 'footer', 'appName'].includes(key)) return;
            if (value.startsWith('http') || value.startsWith('v1.')) return;
            if (key === 'aboutDesc') return; // Already updated

            // If value exactly matches English, it is likely untranslated
            if (enValues[key] && enValues[key] === value && value.length > 5) {
                matches.push({ line: i + 1, key, value: value.substring(0, 80) });
            }
        }
    });
    if (matches.length > 0) {
        console.log('\n=== ' + file + ' (exact EN matches: ' + matches.length + ') ===');
        matches.forEach(m => console.log('  L' + m.line + ': ' + m.key + ' = "' + m.value + '"'));
    }
});
