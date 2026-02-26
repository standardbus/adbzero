/**
 * Command Sanitizer
 * Validates and sanitizes all inputs before they are passed to ADB shell commands.
 * This is the core security layer against command injection.
 * 
 * SECURITY PRINCIPLE: Every input is treated as hostile.
 * No user-provided string should ever be interpolated directly into a shell command.
 */

// ============================================
// PACKAGE NAME VALIDATION
// ============================================

/**
 * Validates an Android package name.
 * Valid: com.android.example, com.samsung.android.app_123
 * Invalid: com.app; rm -rf /, com.app$(cmd), com.app`cmd`
 */
const PACKAGE_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*){1,20}$/

export function validatePackageName(packageName: string): string {
    const trimmed = packageName.trim()

    if (!trimmed) {
        throw new Error('Package name cannot be empty')
    }

    if (trimmed.length > 256) {
        throw new Error('Package name too long')
    }

    if (!PACKAGE_NAME_REGEX.test(trimmed)) {
        throw new Error(`Invalid package name: "${trimmed}". Package names must be like com.example.app`)
    }

    return trimmed
}

// ============================================
// FILE PATH VALIDATION
// ============================================

/**
 * Validates a remote file path on the Android device.
 * Blocks:
 * - Command injection characters: ; | & $ ` ( ) { } < > ! ~ 
 * - Path traversal beyond allowed roots
 * - Null bytes
 */
const DANGEROUS_PATH_CHARS = /[;|&$`(){}<>!~\x00\n\r]/

const ALLOWED_PATH_PREFIXES = [
    '/data/local/tmp/',
    '/sdcard/',
    '/storage/',
    '/system/',
    '/product/',
    '/vendor/',
    '/apex/',
    '/data/data/',
    '/data/app/',
]

export function validateFilePath(path: string, allowedPrefixes?: string[]): string {
    const trimmed = path.trim()

    if (!trimmed) {
        throw new Error('File path cannot be empty')
    }

    if (trimmed.length > 1024) {
        throw new Error('File path too long')
    }

    // Block dangerous characters
    if (DANGEROUS_PATH_CHARS.test(trimmed)) {
        throw new Error(`File path contains dangerous characters: "${trimmed}"`)
    }

    // Must be absolute
    if (!trimmed.startsWith('/')) {
        throw new Error('File path must be absolute (start with /)')
    }

    // Normalize and check for path traversal
    // Split, remove empty and '.', handle '..'
    const parts = trimmed.split('/')
    const normalized: string[] = []
    for (const part of parts) {
        if (part === '' || part === '.') continue
        if (part === '..') {
            if (normalized.length > 0) normalized.pop()
            continue
        }
        normalized.push(part)
    }
    const normalizedPath = '/' + normalized.join('/')

    // Check against allowed prefixes
    const prefixes = allowedPrefixes || ALLOWED_PATH_PREFIXES
    const isAllowed = prefixes.some(prefix => normalizedPath.startsWith(prefix))

    if (!isAllowed) {
        throw new Error(`File path "${normalizedPath}" is not in an allowed directory`)
    }

    return normalizedPath
}

// ============================================
// NUMERIC VALUE VALIDATION
// ============================================

/**
 * Validates a numeric value within a range.
 */
export function validateNumericValue(value: number, min: number, max: number, name: string): number {
    if (typeof value !== 'number' || isNaN(value)) {
        throw new Error(`${name} must be a valid number`)
    }

    if (!Number.isFinite(value)) {
        throw new Error(`${name} must be a finite number`)
    }

    if (value < min || value > max) {
        throw new Error(`${name} must be between ${min} and ${max}, got ${value}`)
    }

    return value
}

/**
 * Validates an integer value within a range.
 */
export function validateIntegerValue(value: number, min: number, max: number, name: string): number {
    validateNumericValue(value, min, max, name)

    if (!Number.isInteger(value)) {
        throw new Error(`${name} must be an integer, got ${value}`)
    }

    return value
}

// ============================================
// SETTINGS COMMAND VALIDATION
// ============================================

/**
 * Whitelist of allowed Android settings namespaces
 */
const ALLOWED_SETTINGS_NAMESPACES = ['system', 'secure', 'global']

/**
 * Whitelist of allowed setting keys (only these can be read/written)
 */
const ALLOWED_SETTING_KEYS = new Set([
    // Display
    'font_scale',
    'window_animation_scale',
    'transition_animation_scale',
    'animator_duration_scale',
    'screen_off_timeout',
    'screen_brightness_mode',
    'stay_on_while_plugged_in',
    'show_touches',
    'pointer_location',
    'force_gpu_rendering',
    'debug_gpu_overdraw',
    // Privacy
    'adb_wifi_enabled',
    'install_non_market_apps',
    'usage_stats_enabled',
    'send_action_app_error',
    // DNS
    'private_dns_mode',
    'private_dns_specifier',
    // Desktop mode
    'force_resizable_activities',
    'enable_freeform_support',
])

/**
 * Settings key regex: alphanumeric + underscores only
 */
const SETTING_KEY_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,128}$/

/**
 * Validates a `settings get/put` command and returns it sanitized.
 */
export function validateSettingsCommand(
    action: 'get' | 'put',
    namespace: string,
    key: string,
    value?: string
): string {
    if (!ALLOWED_SETTINGS_NAMESPACES.includes(namespace)) {
        throw new Error(`Invalid settings namespace: "${namespace}"`)
    }

    if (!SETTING_KEY_REGEX.test(key)) {
        throw new Error(`Invalid setting key: "${key}"`)
    }

    if (!ALLOWED_SETTING_KEYS.has(key)) {
        throw new Error(`Setting key not in allowlist: "${key}"`)
    }

    if (action === 'get') {
        return `settings get ${namespace} ${key}`
    }

    if (value === undefined) {
        throw new Error('Value is required for settings put')
    }

    // Validate value - only allow simple values (numbers, simple strings, "")
    const trimmedValue = value.trim()
    if (trimmedValue.length > 256) {
        throw new Error('Settings value too long')
    }
    if (DANGEROUS_PATH_CHARS.test(trimmedValue)) {
        throw new Error(`Settings value contains dangerous characters: "${trimmedValue}"`)
    }

    return `settings put ${namespace} ${key} ${trimmedValue}`
}

// ============================================
// DNS HOSTNAME VALIDATION
// ============================================

/**
 * Valid DNS hostname pattern
 */
const DNS_HOSTNAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export function validateDnsHostname(hostname: string): string {
    const trimmed = hostname.trim()

    if (!trimmed) return '' // Empty means disable

    if (trimmed.length > 253) {
        throw new Error('DNS hostname too long')
    }

    if (!DNS_HOSTNAME_REGEX.test(trimmed)) {
        throw new Error(`Invalid DNS hostname: "${trimmed}"`)
    }

    return trimmed
}

// ============================================
// ANDROID PERMISSION VALIDATION
// ============================================

/**
 * Valid Android permission format: android.permission.CAMERA or com.vendor.permission.XXX
 */
const PERMISSION_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*){2,10}$/

export function validatePermission(permission: string): string {
    const trimmed = permission.trim()

    if (!trimmed) {
        throw new Error('Permission cannot be empty')
    }

    if (trimmed.length > 256) {
        throw new Error('Permission name too long')
    }

    if (!PERMISSION_REGEX.test(trimmed)) {
        throw new Error(`Invalid permission format: "${trimmed}"`)
    }

    return trimmed
}

// ============================================
// APPOPS VALIDATION
// ============================================

const APPOPS_REGEX = /^[A-Z_]{2,50}$/

export function validateAppOp(op: string): string {
    const trimmed = op.trim()

    if (!APPOPS_REGEX.test(trimmed)) {
        throw new Error(`Invalid appops operation: "${trimmed}"`)
    }

    return trimmed
}

// ============================================
// TERMINAL COMMAND VALIDATION
// ============================================

/**
 * Whitelist of allowed terminal command prefixes.
 * This is the most critical security boundary.
 * 
 * Every command typed in the interactive terminal MUST match one of these patterns.
 * Adding new commands here requires careful security review.
 */
const ALLOWED_TERMINAL_COMMANDS: Array<{ pattern: RegExp; description: string }> = [
    // Package Manager
    { pattern: /^pm\s+(list\s+packages|path|dump|disable-user|enable|install-existing|uninstall|install|grant|revoke|clear|force-stop|set-installer|get-install-location)(\s|$)/, description: 'Package manager operations' },

    // Activity Manager
    { pattern: /^am\s+(start|force-stop|kill|broadcast|instrument|profile)(\s|$)/, description: 'Activity manager operations' },

    // Device properties
    { pattern: /^getprop(\s|$)/, description: 'Get device properties' },
    { pattern: /^setprop\s+/, description: 'Set device properties' },

    // Settings
    { pattern: /^settings\s+(get|put|list)\s+(system|secure|global)(\s|$)/, description: 'Android settings' },

    // Display
    { pattern: /^wm\s+(size|density|overscan)(\s|$)/, description: 'Window manager' },

    // System info
    { pattern: /^dumpsys\s+(battery|display|window|activity|meminfo|cpuinfo|package|diskstats|netstats|usagestats|notification|alarm|power|connectivity|wifi)(\s|$)/, description: 'System dump' },
    { pattern: /^cat\s+\//, description: 'Read files' },
    { pattern: /^ls(\s|$)/, description: 'List files' },
    { pattern: /^df(\s|$)/, description: 'Disk free' },
    { pattern: /^du(\s|$)/, description: 'Disk usage' },
    { pattern: /^ps(\s|$)/, description: 'Process list' },
    { pattern: /^top(\s|$)/, description: 'Top processes' },
    { pattern: /^id(\s|$)/, description: 'User identity' },
    { pattern: /^whoami(\s|$)/, description: 'Who am I' },
    { pattern: /^uname(\s|$)/, description: 'System info' },
    { pattern: /^uptime(\s|$)/, description: 'System uptime' },
    { pattern: /^date(\s|$)/, description: 'Date/time' },
    { pattern: /^free(\s|$)/, description: 'Memory info' },
    { pattern: /^mount(\s|$)/, description: 'Mount info (read only)' },

    // Network
    { pattern: /^ping(\s|$)/, description: 'Ping' },
    { pattern: /^ifconfig(\s|$)/, description: 'Network interfaces' },
    { pattern: /^ip\s+(addr|link|route|rule|neigh)(\s|$)/, description: 'IP configuration' },
    { pattern: /^netstat(\s|$)/, description: 'Network statistics' },
    { pattern: /^nslookup(\s|$)/, description: 'DNS lookup' },

    // AppOps
    { pattern: /^appops\s+(get|set|reset)\s+/, description: 'App operations' },

    // Input
    { pattern: /^input\s+(tap|swipe|keyevent|text)(\s|$)/, description: 'Input simulation' },

    // Screen capture (read-only)
    { pattern: /^screencap(\s|$)/, description: 'Screen capture' },
    { pattern: /^screenrecord(\s|$)/, description: 'Screen recording' },

    // Logcat (read-only)
    { pattern: /^logcat(\s|$)/, description: 'Log viewer' },

    // Service list (read-only)
    { pattern: /^service\s+(list|check)(\s|$)/, description: 'Service operations' },

    // Content provider (read-only)
    { pattern: /^content\s+(query|read)(\s|$)/, description: 'Content provider query' },

    // Monkey test
    { pattern: /^monkey(\s|$)/, description: 'UI monkey tester' },

    // Grep (search only)
    { pattern: /^grep(\s|$)/, description: 'Text search' },

    // Prop info
    { pattern: /^getprop(\s|$)/, description: 'Property info' },
]

/**
 * Dangerous patterns that should NEVER appear in terminal commands
 */
const DANGEROUS_COMMAND_PATTERNS = [
    /;\s*/,             // Command chaining with ;
    /\|\|/,             // OR chaining
    /&&/,               // AND chaining
    /(^|[^&])&([^&]|$)/, // Single & command separator
    /`/,                // Backtick substitution
    /\$\(/,             // Command substitution $(...)
    /\$\{/,             // Variable expansion ${...}
    /[\n\r]/,           // Newline / multi-line command injection
    />\s*\//,           // Output redirection to absolute path
    />>/,               // Append redirection
    /\bsu\b/,           // Root elevation
    /\b(sh|bash|zsh|ksh)\s+-c\b/, // Shell trampoline
    /\brm\s/,           // Remove files
    /\bdd\b/,           // Direct disk access
    /\breboot\b/,       // Reboot
    /\bshutdown\b/,     // Shutdown
    /\bformat\b/,       // Format
    /\bmkfs\b/,         // Make filesystem
    /\bflash\b/,        // Flash
    /\bfastboot\b/,     // Fastboot
    /\brecovery\b/,     // Recovery mode
    /\bwipe\b/,         // Wipe data
    /\bchmod\s/,        // Change permissions
    /\bchown\s/,        // Change owner
    /\bmount\s+-o\s+rw/, // Mount read-write
]

export interface CommandValidationResult {
    isValid: boolean
    sanitizedCommand: string
    reason?: string
    matchedRule?: string
}

/**
 * Validates a command entered in the interactive terminal.
 * This is the MOST CRITICAL security function.
 */
export function validateTerminalCommand(command: string): CommandValidationResult {
    const trimmed = command.trim()

    if (!trimmed) {
        return { isValid: false, sanitizedCommand: '', reason: 'Command is empty' }
    }

    if (trimmed.length > 2048) {
        return { isValid: false, sanitizedCommand: '', reason: 'Command too long (max 2048 chars)' }
    }

    // Optional single pipe is allowed only as "... | grep ...".
    // Any other pipeline shape is blocked.
    let commandToValidate = trimmed
    if (trimmed.includes('|')) {
        const parts = trimmed
            .split('|')
            .map(part => part.trim())
            .filter(Boolean)

        if (parts.length !== 2) {
            return {
                isValid: false,
                sanitizedCommand: '',
                reason: 'Only one pipe is allowed, and only to grep.'
            }
        }

        const [left, right] = parts
        if (!/^grep(\s|$)/.test(right)) {
            return {
                isValid: false,
                sanitizedCommand: '',
                reason: 'Pipes are only allowed when piping to grep.'
            }
        }

        // Ensure grep side does not introduce extra shell control flow.
        if (/[;&`$<>{}]/.test(right)) {
            return {
                isValid: false,
                sanitizedCommand: '',
                reason: 'Grep arguments contain blocked shell metacharacters.'
            }
        }

        commandToValidate = left
    }

    // Check for dangerous patterns FIRST
    for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
        if (pattern.test(trimmed)) {
            return {
                isValid: false,
                sanitizedCommand: '',
                reason: `Command contains a blocked pattern: ${pattern.source}. For security, this operation is not allowed in the terminal.`
            }
        }
    }

    // Check against whitelist
    for (const rule of ALLOWED_TERMINAL_COMMANDS) {
        if (rule.pattern.test(commandToValidate)) {
            return {
                isValid: true,
                sanitizedCommand: trimmed,
                matchedRule: rule.description
            }
        }
    }

    return {
        isValid: false,
        sanitizedCommand: '',
        reason: `Command "${trimmed.split(' ')[0]}" is not in the allowed commands list. Only ADB-related commands are permitted.`
    }
}

/**
 * Escapes a value for safe use inside shell double quotes.
 * This is a SECONDARY defense - primary defense is validation.
 */
export function escapeShellArg(arg: string): string {
    // Replace dangerous chars
    return arg
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\$/g, '\\$')
        .replace(/`/g, '\\`')
        .replace(/!/g, '\\!')
}

// ============================================
// INPUT LENGTH VALIDATION
// ============================================

/**
 * Validates text input length and basic content
 */
export function validateTextInput(
    value: string,
    fieldName: string,
    maxLength: number,
    minLength: number = 0
): string {
    const trimmed = value.trim()

    if (trimmed.length < minLength) {
        throw new Error(`${fieldName} must be at least ${minLength} characters`)
    }

    if (trimmed.length > maxLength) {
        throw new Error(`${fieldName} must be at most ${maxLength} characters`)
    }

    return trimmed
}
