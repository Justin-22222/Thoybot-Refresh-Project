console.log('[Bootstrap] Starting bot');
const appVer = '0.5.0';
console.log(`[Bootstrap] Launching Thoybot v${appVer}`)

/**
 * Checks if a required module is installed.
 * If the module is missing, logs an error and exits the program.
 * 
 * @param {string} moduleName - The name of the module to check.
 */
function ensureModuleExists(moduleName) {
    try {
        require.resolve(moduleName);
        console.log(`[Bootstrap/Module] Module '${moduleName}' is loaded successfully.`);
    } catch {
        console.error(`[Bootstrap/Fatal] Missing required module '${moduleName}'.`);
        process.exit(1);
    }
}

/**
 * Dynamically requires a module after ensuring it exists.
 * 
 * @param {string} moduleName - The name of the module to require.
 * @returns {*} - The required module.
 */
function safeRequire(moduleName) {
    ensureModuleExists(moduleName);
    return require(moduleName);
}

/**
 * Checks if the required configuration values are present and valid.
 * 
 * This function checks whether the configuration object contains the necessary keys (`token`, `clientId`, and `timezone`).
 * It also ensures that these values are not empty strings or null/undefined.
 * If any of the required keys are missing or invalid, an error message is logged and the process exits.
 *
 * @param {Object} config - The configuration object to be validated.
 * @param {string} config.token - The token required for authentication.
 * @param {string} config.clientId - The client ID required for identification.
 * @param {string} config.timezone - The timezone to be used for date and time formatting.
 * @throws {Error} Will throw an error and terminate the process if any required values are missing or invalid.
 */
function checkConfigValues(config) {
    const requiredKeys = ['token', 'clientId', 'timezone'];
    const missingKeys = requiredKeys.filter(key => !config[key] || (typeof config[key] === 'string' && config[key].trim() === ''));

    if (missingKeys.length > 0) {
        console.error(`[Bootstrap/Fatal] Missing or invalid config values for: ${missingKeys.join(', ')}`);
        process.exit(1);
    }
}

// Safely load required modules
const discord = safeRequire('discord.js');
const luxon = safeRequire('luxon');
const fs = safeRequire('fs');
const path = safeRequire('path');
const readline = safeRequire('readline');
const winston = safeRequire('winston');
const DailyRotateFile = safeRequire('winston-daily-rotate-file');
const JSON5 = safeRequire('json5');
const { getClockEmoji, getRandomColor } = safeRequire('./utils/loadUtils.js');

// Load configuration file
let config;
try {
    config = require('./jsons/config.json');
    console.log("[Bootstrap/Config] Config file 'config.json' loaded successfully.");
} catch (error) {
    console.error('[Bootstrap/Fatal] Missing or invalid config.json file.');
    console.error(`[Bootstrap/Fatal] Error info:${error}`);
    process.exit(1);
}

// Validate configuration values
checkConfigValues(config);

/**
 * Log level mapping table, which maps different environments to different log levels.
 * @type {Object<string, string>}
 * @property {string} development - Corresponds to the log level 'debug' for the development environment.
 * @property {string} production - Corresponds to the log level 'warn' for the production environment.
 * @property {string} test - Corresponds to the log level 'error' for the test environment.
 */
const levelMapping = {
    development: 'debug',
    production: 'warn',
    test: 'error'
};

/**
 * Logic to determine the log level.
 * The log level is determined based on the configuration value (`config.logLevel`),
 * the environment variable (`process.env.NODE_ENV`), and a default value.
 * 
 * @type {string} The log level, which can be one of the following values:
 * 'silly', 'input', 'verbose', 'prompt', 'debug',
 * 'info', 'data', 'help', 'warn', 'error', 'fatal', or the default value 'info'.
 */
const logLevel =
    config.logLevel ||
    levelMapping[process.env.NODE_ENV] || // Maps `NODE_ENV` value to a log level
    'info';
    

// Import specific parts of modules after ensuring they exist
console.log('[Bootstrap] Setting packages');
const { Client, Collection, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle, REST, Routes } = discord;
const { DateTime } = luxon;
console.log('[Bootstrap] Successfully set packages');

console.log(`[Bootstrap] Timezone: ${config.timezone}`);

const ITEMS_PER_PAGE = config.tzperpages; // set timezones per pages
console.log(`[Bootstrap] Timezone per page: ${ITEMS_PER_PAGE}`);


console.log('[Bootstrap] Initializing client');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
console.log('[Bootstrap] Initialized client');

console.log('[Bootstrap] Initializing readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
});
console.log('[Bootstrap] Initialized readline');

console.log('[Bootstrap] Setting up basic output functions');
const customLevels = {
    silly: 10,
    input: 9,
    verbose: 8,
    prompt: 7,
    debug: 6,
    info: 5,
    data: 4,
    help: 3,
    warn: 2,
    error: 1,
    fatal: 0
};

// Custom color
const customColors = {
    silly: 'grey',
    input: 'grey',
    verbose: 'cyan',
    prompt: 'grey',
    debug: 'blue',
    info: 'green',
    data: 'grey',
    help: 'cyan',
    warn: 'yellow',
    error: 'red',
    fatal: 'bold red'
};

// Timestamp formatting function
const formatTimestamp = (tz = config.timezone || 'UTC') => {
    return DateTime.now().setZone(tz).toFormat('yyyy-MM-dd HH:mm:ss.SSS');
};

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ level, message, timestamp }) => {
    // If it is ERROR or FATAL, the entire log needs to be colored
    if (level === 'error' || level === 'fatal') {
      return `${timestamp} [${winston.format.colorize().colorize(level, level.toUpperCase())}]: ${winston.format.colorize().colorize(level, message)}`;
    } else {
      // For other levels, only the level field is colored
      return `${timestamp} [${winston.format.colorize().colorize(level, level.toUpperCase())}]: ${message}`;
    }
  })
);

winston.addColors(customColors); // Register a custom color

// Create Logger
const logger = winston.createLogger({
    levels: customLevels,
    level: logLevel, // Preset captures all levels
    format: winston.format.combine(
        winston.format((info) => {
            info.timestamp = formatTimestamp();  // Add timestamp
            return info;
        })(),
        logFormat
    ),
    transports: [
        // Console output (color)
        new winston.transports.Console({
            level: logLevel,  // Console shows all levels
            format: winston.format.combine(
                logFormat,
                winston.format.timestamp()
            ),
            stderrLevels: [ 'error', 'fatal' ]
        }),

        // Detailed logs of daily rotation (only info and higher level logs are recorded)
        new DailyRotateFile({
            level: 'info',  // Only logs at info level and above are recorded
            dirname: path.join(process.cwd(), 'logs'),
            filename: 'combined-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d'
        }),

        // Error log (only error and higher level logs are recorded)
        new DailyRotateFile({
            level: 'error',  // Only logs with error level and above are recorded
            dirname: path.join(process.cwd(), 'logs'),
            filename: 'error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d'
        }),

        // Fatal error log (only fatal level logs are recorded)
        new DailyRotateFile({
            level: 'fatal',  // Only log fatal level logs
            dirname: path.join(process.cwd(), 'logs'),
            filename: 'fatal-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d'
        })
    ],
    exitOnError: false
});

// Add special handling for fatal errors
logger.on('fatal', (message) => {
    console.error(`FATAL ERROR: ${message}`);
    rl.close();
    client.destroy();
    process.exit(1);
});

// Create corresponding timestamped methods for all levels
const createTimestampMethod = (level) => {
    return (message, ...args) => {
        logger.log({
            level,
            message: message,
            ...args
        });
    };
};

// Create a log method corresponding to the original method
const logWithTimestamp = createTimestampMethod('info');
const warnWithTimestamp = createTimestampMethod('warn');
const errorWithTimestamp = createTimestampMethod('error');
const infoWithTimestamp = createTimestampMethod('info');

// Additional ways to add other levels
const sillyWithTimestamp = createTimestampMethod('silly');
const inputWithTimestamp = createTimestampMethod('input');
const verboseWithTimestamp = createTimestampMethod('verbose');
const promptWithTimestamp = createTimestampMethod('prompt');
const debugWithTimestamp = createTimestampMethod('debug');
const dataWithTimestamp = createTimestampMethod('data');
const helpWithTimestamp = createTimestampMethod('help');
const fatalWithTimestamp = createTimestampMethod('fatal');
console.log('[Bootstrap] Basic output function setting successfully');

console.log('[Bootstrap] Globalize variables');
global.client = client;
global.appVer = appVer;
global.config = config;
global.getRandomColor = getRandomColor;
global.getClockEmoji = getClockEmoji;
global.logWithTimestamp = logWithTimestamp;
global.warnWithTimestamp = warnWithTimestamp;
global.errorWithTimestamp = errorWithTimestamp;
global.infoWithTimestamp = infoWithTimestamp;
global.sillyWithTimestamp = sillyWithTimestamp;
global.inputWithTimestamp = inputWithTimestamp;
global.verboseWithTimestamp = verboseWithTimestamp;
global.promptWithTimestamp = promptWithTimestamp;
global.debugWithTimestamp = debugWithTimestamp;
global.dataWithTimestamp = dataWithTimestamp;
global.helpWithTimestamp = helpWithTimestamp;
global.fatalWithTimestamp = fatalWithTimestamp;
console.log('[Bootstrap] Global variables set successfully');

console.log('[Bootstrap] Set variables');
client.commands = new Collection();
client.buttons = new Collection();
client.selectMenus = new Collection();
client.commandInfo = {}; // Used to store info for each command
console.log('[Bootstrap] All variables are set successfully');

console.log('[Bootstrap] Setting command function');
const loadCommands = () => {
    logWithTimestamp('[Command] Starting to load commands');
    
    if (!client.commands) client.commands = new Collection();
    if (!client.commandInfo) client.commandInfo = {};

    const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
    const commands = [];
    let loadedCommandCount = 0; // Track the number of commands loaded

    const isValidCommand = (command, file) => {
        if (!command.data || !command.execute) {
            warnWithTimestamp(`[Command] Warning: Command file ${file} is missing 'data' or 'execute'. Skipping.`);
            return false;
        }
        if (command.enabled === false) {
            warnWithTimestamp(`[Command] Command '${command.data.name}' is disabled, skipping.`);
            return false;
        }
        return true;
    };

    for (const file of commandFiles) {
        try {
            const command = require(path.join(__dirname, 'commands', file));

            // Handle legacy format by assigning 'data' from 'name' if necessary
            if (!command.data) {
                if (command.name) {
                    command.data = { name: command.name };
                } else {
                    warnWithTimestamp(`[Command] Warning: Command file ${file} is missing 'data' or 'name'. Skipping.`);
                    continue;
                }
            }

            // Validate the command format
            if (!isValidCommand(command, file)) continue;

            // If using SlashCommandBuilder format, ensure it is valid
            if (command.data instanceof SlashCommandBuilder) {
                if (!command.data.name || !command.execute) {
                    warnWithTimestamp(`[Command] Warning: Command file ${file} is missing 'data.name' or 'execute'. Skipping.`);
                    continue;
                }
            }

            // Log the successfully loaded command
            debugWithTimestamp(`[Command] Loaded command: ${command.data.name}`);
            loadedCommandCount++;

            // Load subcommands if they exist
            if (command.subcommands) {
                loadSubcommands(command.subcommands, command.data);
            }

            // Add the command to the collection
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON ? command.data.toJSON() : command.data);

            // Store additional command info
            if (command.info) {
                client.commandInfo[command.data.name] = command.info;
            }

        } catch (error) {
            errorWithTimestamp(`[Command] Error loading command file ${file}: ${error}`);
        }
    }

    // Log the total number of commands loaded
    logWithTimestamp(`[Command] Total commands loaded: ${loadedCommandCount}`);
    logWithTimestamp('[Command] All commands loaded');

    return commands;
};

// Loading subcommands
const loadSubcommands = (subcommands, parentCommandData) => {

    logWithTimestamp('[Subcommand] Starting load subcommands');
    // Ensure the parent command has the method `addSubcommand`
    if (!parentCommandData.addSubcommand) {
        errorWithTimestamp(`[ERROR/Subcommand] Parent command '${parentCommandData.name}' does not have the method 'addSubcommand'. Skipping subcommands.`);
        return;
    }
    
    logWithTimestamp(`[Subcommand] Loading subcommands for ${parentCommandData.name}`);

    // Initialize a counter for the number of loaded subcommands
    let loadedSubcommandsCount = 0;

    // Iterate over all subcommands
    for (const subcommand of subcommands) {
        const fullCommandName = `${parentCommandData.name} ${subcommand.data.name}`;

        try {
            // Make sure the subcommand structure is correct
            if (!subcommand || !subcommand.data || !subcommand.data.name || !subcommand.execute) {
                warnWithTimestamp(`[WARN/Subcommand] Warning: Subcommand '${fullCommandName}' is missing 'data' or 'name' or 'execute'. Skipping.`);
                continue;
            }

            // If the subcommand is disabled, it is skipped.
            if (subcommand.enabled === false) {
                warnWithTimestamp(`[Subcommand] Subcommand '${fullCommandName}' is disabled, skipping.`);
                continue;
            }

            // Add subcommand to the parent command's subcommand
            parentCommandData.addSubcommand(subcommand.data);

            // Output information about successful subcommand loading
            debugWithTimestamp(`[Subcommand] Loaded subcommand: ${fullCommandName}`);

            // If there is additional information, it can be stored
            if (subcommand.info) {
                client.commandInfo[fullCommandName] = subcommand.info;
            }

            // Subcommands are added to the client's command set.
            client.commands.set(fullCommandName, subcommand);

            // Increment the count of loaded subcommands
            loadedSubcommandsCount++;

        } catch (error) {
            errorWithTimestamp(`[ERROR/Subcommand] Error loading subcommand '${fullCommandName}': ${error}`);
        }
    }

    // Display the number of loaded subcommands for the parent command
    const subcommandWord = loadedSubcommandsCount === 1 ? 'subcommand' : 'subcommands';
    logWithTimestamp(`[Subcommand] Loaded ${loadedSubcommandsCount} ${subcommandWord} for ${parentCommandData.name}`);
};
console.log('[Bootstrap] Command function set successfully');

console.log('[Bootstrap] Setting button function');
const loadButtons = () => {
    const buttonFiles = fs.readdirSync(path.join(__dirname, 'buttons')).filter(file => file.endsWith('.js'));
    
    logWithTimestamp('[Button] Starting load buttons');

    for (const file of buttonFiles) {
        try {
            const button = require(path.join(__dirname, 'buttons', file));
            if (button.customId && button.execute) {
                if (Array.isArray(button.customId)) {
                    // If there are multiple customIds, register them separately
                    button.customId.forEach(id => client.buttons.set(id, button));
                } else {
                    client.buttons.set(button.customId, button);
                }
                debugWithTimestamp(`[Button] Loaded button: ${button.customId}`);
            } else {
                warnWithTimestamp(`[Button] Invalid button file: ${file}`);
            }
        } catch (error) {
            errorWithTimestamp(`[Button] Failed to load button file ${file}: ${error}`);
        }
    }

    logWithTimestamp('[Button] Loaded all buttons');
};
console.log('[Bootstrap] Button function set successfully');

console.log('[Bootstrap] Setting menu function');
const loadSelectMenus = () => {
    const selectMenuPath = path.join(__dirname, 'selectmenu'); // Get the path to the selectmenu directory

    // Read all files ending with .js in the directory
    const selectMenuFiles = fs.readdirSync(selectMenuPath).filter(file => file.endsWith('.js'));
    
    logWithTimestamp('[SelectMenu] Starting load select menus')
    
    // Traverse each select menu file
    for (const file of selectMenuFiles) {
        const filePath = path.join(selectMenuPath, file);  // Get the full path of the file

        try {
            const selectMenu = require(filePath);  // Dynamically loading modules

            if (selectMenu.data && selectMenu.execute) {
                // Register the custom_id and corresponding execution method of each select menu
                client.selectMenus.set(selectMenu.data.custom_id, selectMenu);
                debugWithTimestamp(`[SelectMenu] Loaded select menu: ${selectMenu.data.custom_id}`);
            } else {
                warnWithTimestamp(`[SelectMenu] Invalid select menu file: ${file}`);
            }
        } catch (error) {
            errorWithTimestamp(`[SelectMenu] Failed to load select menu file ${file}: ${error}`);
        }
    }

    logWithTimestamp('[SelectMenu] Loaded all select menus');
};
console.log('[Bootstrap] Menu function set successfully');

console.log('[Bootstrap] Setting readline function');
const loadReadlineCommands = () => {
    logWithTimestamp('[Readline] Starting load readline command');
    
    const readlineCommands = {};

    try {
        // Dynamically loading command modules
        fs.readdirSync(path.join(__dirname, 'console')).forEach(file => {
            // Make sure to only load files ending with .js
            if (file.endsWith('.js')) {
                try {
                    const command = require(path.join(__dirname, 'console', file));
                    if (command.name) {
                        readlineCommands[command.name] = command;
                        debugWithTimestamp(`[Readline] Loaded command ${command.name}`);
                    } else {
                        warnWithTimestamp(`[Readline] Command in ${file} does not have a 'name' property.`);
                    }
                } catch (err) {
                    errorWithTimestamp(`[Readline] Error loading command from ${file}: ${err}`);
                }
            }
        });
    } catch (err) {
        errorWithTimestamp('[ERROR/Readline] Error reading commands directory:', err);
    }

    logWithTimestamp('[Readline] Loaded all commands');
    return readlineCommands;
};
console.log('[Bootstrap] Readline function set successfully');

console.log('[Bootstrap] Setting register command function');
// Register slash command
const registerSlashCommands = async (commands) => {
    const rest = new REST({ version: '10' }).setToken(config.token);

    try {
        logWithTimestamp('[Command] Started refreshing application (/) commands.');
        await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
        logWithTimestamp('[Command] Successfully reloaded application (/) commands.');
    } catch (error) {
        errorWithTimestamp('[Command] Failed to register slash commands:', error);
    }
};
console.log('[Bootstrap] Register command function set successfully');

// Initialize the robot
console.log(`[Bootstrap] Initializing bot event 'ready'`);
client.once('ready', async () => {
    // Register slash command
    const commands = loadCommands();
    loadButtons();
    loadSelectMenus();
    await registerSlashCommands(commands);
    
    logWithTimestamp(`[Client] Logged in as ${client.user.tag}!`);
    logWithTimestamp('[Bot] bot started successfully');
    rl.prompt();
});
console.log(`[Bootstrap] Initialized bot event 'ready'`);

console.log(`[Bootstrap] Initializing bot event 'interactionCreate'`);
// Listen for interaction events
client.on('interactionCreate', async (interaction) => {
    // Handling slash commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) return;
    
        try {
            await command.execute(interaction);
        } catch (error) {
            errorWithTimestamp(error);
    
            // If the interaction has already been responded to, use editReply() to handle the error message
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: '發生錯誤，請稍後再試！', ephemeral: true });
            } else {
                // Otherwise, respond with a new error message
                await interaction.reply({ content: '發生錯誤，請稍後再試！', ephemeral: true });
            }
        }
    } else if (interaction.isButton()) {
        // Parse button base ID
        const baseId = interaction.customId.split('_').slice(0, 2).join('_');
        const button = client.buttons.get(baseId);
        
        if (!button) {
            warnWithTimestamp(`[Button] No handler found for button ID: ${interaction.customId}`);
            return;
        }
        
        // Execute button processing logic
        button.execute(interaction);
    } else if (interaction.isStringSelectMenu()) {
        const customId = interaction.customId;

        // Find and execute the corresponding selectMenu
        const selectMenuHandler = client.selectMenus.get(customId);
        if (selectMenuHandler) {
            await selectMenuHandler.execute(interaction);  // Call the corresponding execution function
        } else {
            warnWithTimestamp(`[SelectMenu]No handler found for select menu with ID: ${customId}`);
        }
    }
});
console.log(`[Bootstrap] Initialized bot event 'interactionCreate'`);

// Login bot
console.log('[Bootstrap] Bootstrap End, logging bot');
client.login(config.token);

// Load event handler
const loadEvents = () => {
    const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
    logWithTimestamp('[Event] Starting load events');

    for (const file of eventFiles) {
        try {
            const event = require(`./events/${file}`);

            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
                debugWithTimestamp(`[Event] Loaded once event ${event.name}`);
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
                debugWithTimestamp(`[Event] Loaded on event ${event.name}`);
            }
        } catch (error) {
            errorWithTimestamp(`[Event] Failed to load event file ${file}: ${error}`);
        }
    }

    logWithTimestamp('[Event] Finished loading all events');
};
loadEvents();

const rlcmd = loadReadlineCommands();

rl.on('line', (input) => {
    const command = rlcmd[input.trim()];

    if (command) {
        try {
            command.execute(rl, client); // Assuming each command has an `execute` method
        } catch (err) {
            errorWithTimestamp(`Error executing command: ${input}`, err);
        }
    } else {
        errorWithTimestamp(`[Readline] Unknown command: ${input}`);
    }

    rl.prompt();
});

// Listen to the readline interface closing event
rl.on('close', () => {
  logWithTimestamp('[Client] Bot exiting');
  process.exit(0); // Exit Program
});