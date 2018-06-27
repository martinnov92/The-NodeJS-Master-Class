const readline = require('readline');
const events = require('events');
const util = require('util');
const debug = util.debuglog('cli');

// doporučený způsob, jak zinicializovat events
class _events extends events {};
const ev = new _events();

// cli
const cli = {};

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

module.exports = cli;