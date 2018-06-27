const os = require('os');
const v8 = require('v8');
const readline = require('readline');
const events = require('events');
const util = require('util');
const debug = util.debuglog('cli');

const _data = require('./data');

// doporučený způsob, jak zinicializovat events
class _events extends events {};
const ev = new _events();

// cli
const cli = {};

//#region EVENTS ON
// input handlers
ev.on('man', function(str) {
    cli.responders.help();
});

ev.on('help', function(str) {
    cli.responders.help();
});

ev.on('exit', function(str) {
    cli.responders.exit();
});

ev.on('stats', function(str) {
    cli.responders.stats();
});

ev.on('list users', function(str) {
    cli.responders.listUsers();
});

ev.on('more user info', function(str) {
    cli.responders.moreUserInfo(str);
});

ev.on('list checks', function(str) {
    cli.responders.listChecks(str);
});

ev.on('more check info', function(str) {
    cli.responders.moreCheckInfo(str);
});

ev.on('list logs', function(str) {
    cli.responders.listLogs(str);
});

ev.on('more log info', function(str) {
    cli.responders.moreLogInfo(str);
});
//#endregion

//#region RESPONDERS
cli.responders = {};

cli.responders.help = function() {
    const commands = {
        'exit': 'Ukončí aplikaci',
        'man': 'Zobrazí nápovědu',
        'help': 'Zobrazí nápovědu',
        'stats': 'Statistika operačního systému',
        'list users': 'Seznam uživatelů',
        'more user info --{userId}': 'Více informací k požadovanému uživateli',
        'list checks --up / --down': 'Zobrazí seznam aktivinách záznamů, včetně jejich stavů. --up / --down jsou volitelné',
        'more check info --{checkId}': 'Zobrazí detail požadovaného záznamu',
        'list logs': 'Zobrazí seznam všech záznamů',
        'more log info --{fileName}': 'Zobrazí detail záznamu',
    };

    // zobrazit hlavičku help page, která je široká jako okno
    cli.horizontalLine();
    cli.centered('CLI MANUAL');
    cli.horizontalLine();
    cli.verticalSpace(2);

    // zobrazit jednotlivé příkazy
    for (let command in commands) {
        let value = commands[command];
        let line = `\x1b[33m${command}\x1b[0m`;
        let padding = 60 - command.length;

        for (i = 0; i < padding; i++) {
            line += ' ';
        }

        line += value;
        console.log(line);
        cli.verticalSpace();
    }

    cli.verticalSpace();
    cli.horizontalLine();
};

cli.responders.exit = function() {
    process.exit(0);
};

cli.responders.stats = function() {
    const stats = {
        'Load average': os.loadavg().join(' '),
        'CPU Count': os.cpus().length,
        'Free Memory': os.freemem(),
        'Current Malloced Memory': v8.getHeapSpaceStatistics().malloced_memory,
        'Peak Malloced Memory': v8.getHeapSpaceStatistics().peak_malloced_memory,
        'Allocated Heap Used (%)': Math.round((v8.getHeapSpaceStatistics().used_heap_size / v8.getHeapSpaceStatistics().total_heap_size) * 100),
        'Available Heap Allocated (%)': Math.round((v8.getHeapSpaceStatistics().total_heap_size / v8.getHeapSpaceStatistics().heap_size_limit) * 100), 
        'Uptime': os.uptime() + ' seconds',
    };

    // zobrazit hlavičku help page, která je široká jako okno
    cli.horizontalLine();
    cli.centered('SYSTEM STATISTICS');
    cli.horizontalLine();
    cli.verticalSpace(2);

    // zobrazit statistiku
    for (let key in stats) {
        let value = stats[key];
        let line = `\x1b[33m${key}\x1b[0m`;
        let padding = 60 - key.length;

        for (i = 0; i < padding; i++) {
            line += ' ';
        }

        line += value;
        console.log(line);
        cli.verticalSpace();
    }

    cli.verticalSpace();
    cli.horizontalLine();
};

cli.responders.listUsers = function() {
    _data.list('users', (err, users) => {
        if (!err && users && users.length > 0) {
            cli.verticalSpace();
            users.forEach((id) => {
                _data.read('users', id, (err, userData) => {
                    if (!err && userData) {
                        const numberOfChecks = ((typeof userData.checks === 'object') && (userData.checks instanceof Array)) ? userData.length : 0;
                        let line = `
                            Name: ${userData.firstName} ${userData.lastName}, Phone: ${userData.phone}
                            Checks count: ${numberOfChecks}
                        `;

                        console.log(line);
                        cli.verticalSpace();
                    }
                });
            });
        }
    });
};

cli.responders.moreUserInfo = function(str) {
    console.log('LIST USERS', str);
};

cli.responders.listChecks = function(str) {
    console.log('LIST CHECKS', str);
};

cli.responders.moreCheckInfo = function(str) {
    console.log('MORE CHECK INFO', str);
};

cli.responders.listLogs = function() {
    console.log('LIST LOGS');
};

cli.responders.moreLogInfo = function() {
    console.log('MORE LOG INFO');
};
//#endregion

//#region CLI methods
cli.processInput = function(str) {
    str = (typeof str === 'string' && str.trim().length > 0) ? str : false;

    if (str) {
        // codify unikátní strings, které identifikují příkazy
        const uniqueInputs = [
            'man',
            'help',
            'exit',
            'stats',
            'list users',
            'more user info',
            'list checks',
            'more check info',
            'list logs',
            'more log info',
        ];

        // zkontrolovat input a emit event, pokud je nalezena shoda
        let counter = 0;
        let matchFound = false;

        uniqueInputs.some((input) => {
            if (str.toLowerCase().indexOf(input) > -1) {
                matchFound = true;

                // emit event, který se shoduje s inputem a zahrnout string, který zadal uživatel
                ev.emit(input, str);
                return true;
            }
        });

        // pokud nebyla nalezena shoda
        if (!matchFound) {
            console.log('⌨️  Příkaz nebyl nalezen. Zkuste to prosím znovu.');
        }
    }
};

cli.init = function() {
    // zobrazit zprávu o spuštění CLI
    console.log('\x1b[34m%s\x1b[0m', '⌨️  CLI is running.');

    // spustit "interface"
    // TODO: zjistit více informací v dokumentaci
    // TODO: zapsat
    const _interface = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '>',
    });

    // vytvořit initial prompt (možnost zadávat příkazy)
    _interface.prompt();

    // obsloužit jednotlivé řádky/příkazy, odešle se událost při stisknutí ENTER
    _interface.on('line', (str) => {
        this.processInput(str);

        // znovu inicializovat promp
        _interface.prompt();
    });

    // pokud uživatel vypne CLI, kill the process
    _interface.on('close', () => {
        // 0 - status code, bez erroru
        process.exit(0);
    });
};

cli.horizontalLine = function() {
    // získat velikost okna
    const width = process.stdout.columns;
    let line = '';

    for (let i = 0; i < width; i++) {
        line += '-';
    }

    console.log(line);
};

cli.centered = function(str) {
    const width = process.stdout.columns;
    str = typeof str === 'string' && str.trim().length > 0 ? str.trim() : '';

    // vypočítat left padding
    let leftPadding = Math.floor((width - str.length) / 2);

    // přidat mezery
    let line = '';

    for (let i = 0; i < leftPadding; i++) {
        line += ' ';
    }

    line += str;

    console.log(line);
};

cli.verticalSpace = function(lines = 1) {
    for (i = 0; i < lines; i++) {
        console.log('');
    }
};
//#endregion

module.exports = cli;