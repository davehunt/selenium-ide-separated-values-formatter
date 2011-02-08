String.prototype.trim = function () {
    return this.replace(/^\s*/, "").replace(/\s*$/, "");
}

/*
 * Separated Values format
 */

this.name = "separated-values";

function convertText(command, converter) {
	var props = ['command', 'target', 'value'];
	for (var i = 0; i < props.length; i++) {
		var prop = props[i];
		command[prop] = converter(command[prop]);
	}
}

/**
 * Parse source and update TestCase. Throw an exception if any error occurs.
 *
 * @param testCase TestCase to update
 * @param source The source to parse
 */
function parse(testCase, source) {
	//\\s*([^\\|\\s]+)\\s*\\|\\s*([^\\|\\s]+)(?:\\s*\\|\\s*([^\\|\\s\\r\\n]+)|.{0})
	var commandLoadPattern =  "\\s*([^\\" +
		options.separator.trim() + "\\s]+)\\s*\\" +
		options.separator.trim() + "\\s*([^\\" +
		options.separator.trim() + "\\s]+)(?:\\s*\\" +
		options.separator.trim() + "\\s*([^\\" +
		options.separator.trim() + "\\s\\r\\n]+)|.{0})";
	var commandRegexp = new RegExp(commandLoadPattern, 'i');
	var commentRegexp = new RegExp(options.commentLoadPattern, 'i');
	var commandOrCommentRegexp = new RegExp("((" + commandLoadPattern + ")|(" + options.commentLoadPattern + "))", 'ig');
	var doc = source;
	var commands = [];
	var commandFound = false;
	var lastIndex;
	while (true) {
		log.debug("doc=" + doc + ", commandRegexp=" + commandRegexp);
		lastIndex = commandOrCommentRegexp.lastIndex;
		var docResult = commandOrCommentRegexp.exec(doc);
		if (docResult) {
			if (docResult[2]) { // command
				var command = new Command();
				command.skip = docResult.index - lastIndex;
				command.index = docResult.index;
				var result = commandRegexp.exec(doc.substring(lastIndex));
				eval(options.commandLoadScript);
				commands.push(command);
				if (!commandFound) {
					// remove comments before the first command or comment
					for (var i = commands.length - 1; i >= 0; i--) {
						if (commands[i].skip > 0) {
							commands.splice(0, i);
							break;
						}
					}
					commandFound = true;
				}
			} else { // comment
				var comment = new Comment();
				comment.skip = docResult.index - lastIndex;
				comment.index = docResult.index;
				var result = commentRegexp.exec(doc.substring(lastIndex));
				eval(options.commentLoadScript);
				commands.push(comment);
			}
		} else {
			break;
		}
	}
	if (commands.length > 0) {
		//log.debug("commands.length=" + commands.length);
		testCase.commands = commands;
	} else {
		throw "no command found";
	}
}

function getSourceForCommand(commandObj) {
	var command = null;
	var comment = null;
	var template = '';
	if (commandObj.type == 'command') {
		command = commandObj;
		command = command.createCopy();
		if (command.value == '') {
			template = "${command.command}${options.separator}${command.target}\n";
		} else {
			template = "${command.command}${options.separator}${command.target}${options.separator}${command.value}\n";
		}
	} else if (commandObj.type == 'comment') {
		comment = commandObj;
		template = options.commentTemplate;
	}
	var result;
	var text = template.replace(/\$\{([a-zA-Z0-9_\.]+)\}/g, 
        function(str, p1, offset, s) {
            result = eval(p1);
            return result != null ? result : '';
        });
	return text;
}

/**
 * Format an array of commands to the snippet of source.
 * Used to copy the source into the clipboard.
 *
 * @param The array of commands to sort.
 */
function formatCommands(commands) {
	var commandsText = '';
	for (i = 0; i < commands.length; i++) {
		var text = getSourceForCommand(commands[i]);
		commandsText = commandsText + text;
	}
	return commandsText;
}

/**
 * Format TestCase and return the source.
 *
 * @param testCase TestCase to format
 * @param name The name of the test case, if any. It may be used to embed title into the source.
 * @param saveHeaderAndFooter true if the header and footer should be saved into the TestCase.
 */
function format(testCase, name) {
	var text;
	var header = "";
	var footer = "";
	var commandsText = "";
	var testText;
	var i;
	
	for (i = 0; i < testCase.commands.length; i++) {
		var text = getSourceForCommand(testCase.commands[i]);
		commandsText = commandsText + text;
	}
	
	var testText;

	testText = options.testTemplate;
	testText = testText.replace(/\$\{name\}/g, name);
	testText = testText.replace(/\$\{baseURL\}/g, testCase.getBaseURL());
	var commandsIndex = testText.indexOf("${commands}");
	if (commandsIndex >= 0) {
		header = testText.substr(0, commandsIndex);
		footer = testText.substr(commandsIndex + "${commands}".length);
		testText = header + commandsText + footer;
		testCase.formatLocal(this.name).header = header;
		testCase.formatLocal(this.name).footer = footer;
	}
	
	return testText;
}


/*
 * Optional: The customizable option that can be used in format/parse functions.
 */
this.options = {
	
	separator: " | ",

	commandLoadScript:
	"command.command = result[1];\n" +
	"command.target = result[2];\n" +
	"command.value = result[3] || '';\n",

	commentLoadPattern:
	"[\\r\\n]\\/\\/(.*)",

	commentLoadScript:
	"comment.comment = result[1];\n",

	testTemplate:
	"#testing: ${baseURL}\n" +
	"#test: ${name}\n" +
	"${commands}",

	commentTemplate:
	"//${comment.comment}\n",
	
	escapeDollar:
	"false"
};

this.configForm = 
	'<description>Separator</description>' +
	'<menulist id="options_separator"><menupopup>' +
	'<menuitem label="pipe (|)" value=" | "/>' +
	'<menuitem label="comma (,)" value=", "/>' +
	'</menupopup></menulist>';