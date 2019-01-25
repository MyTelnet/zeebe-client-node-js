"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parser = require("fast-xml-parser");
const fs = require("fs");
const path = require("path");
class BpmnParser {
    /**
     * Read BPMN files and return an array of one or more parsed BPMN objects.
     * @param filenames - A single BPMN file path, or array of BPMN file paths.
     */
    static parseBpmn(filenames) {
        if (typeof filenames === "string") {
            filenames = [filenames];
        }
        return filenames.map((filename) => {
            const xmlData = fs.readFileSync(filename).toString();
            if (parser.validate(xmlData)) {
                return parser.parse(xmlData, BpmnParser.parserOptions);
            }
            return {};
        });
    }
    // @ TODO: examine Camunda's parse BPMN code
    // https://github.com/camunda/camunda-bpmn-model/tree/master/src/main/java/org/camunda/bpm/model/bpmn
    static getProcessId(bpmnString) {
        const jsonObj = parser.parse(bpmnString, BpmnParser.parserOptions);
        if (jsonObj) {
            if (jsonObj["bpmn:definitions"]) {
                if (jsonObj["bpmn:definitions"]["bpmn:process"]) {
                    const attr = jsonObj["bpmn:definitions"]["bpmn:process"].attr;
                    return attr ? attr["@_id"] : undefined;
                }
            }
        }
        return undefined;
    }
    /**
     * Generate TypeScript constants for task types and message names in BPMN files
     * @param filenames - a BPMN file path or array of BPMN file paths
     */
    static async generateConstantsForBpmnFiles(filenames) {
        if (typeof filenames === "string") {
            filenames = [filenames];
        }
        const parsed = BpmnParser.parseBpmn(filenames);
        const taskTypes = await BpmnParser.getTaskTypes(parsed);
        const messageNames = await BpmnParser.getMessageNames(parsed);
        const files = filenames.map((f) => path.basename(f));
        const taskEnumMembers = taskTypes.map((t) => `\n${t.split("-").join("_").toUpperCase()} = "${t}"`);
        const messageEnumMembers = messageNames.map((m) => `\n${m.split("-").join("_").toUpperCase()} = "${m}"`);
        return `
// Autogenerated constants for ${files}

export enum TaskType {
    ${taskEnumMembers}

};

export enum MessageName {
    ${messageEnumMembers}

};

`;
    }
    /**
     * Take one or more parsed BPMN objects and return an array of unique task types.
     * @param processes - A parsed BPMN object, or an array of parsed BPMN objects.
     */
    static async getTaskTypes(processes) {
        const processArray = Array.isArray(processes) ? processes : [processes];
        return BpmnParser.mergeDedupeAndSort(await Promise.all(processArray.map(BpmnParser.scanBpmnObjectForTasks)));
    }
    /**
     * Take one or more parsed BPMN objects and return an array of unique message names.
     * @param processes - A parsed BPMN object, or an array of parsed BPMN objects.
     */
    static async getMessageNames(processes) {
        const processArray = Array.isArray(processes) ? processes : [processes];
        return BpmnParser.mergeDedupeAndSort(await Promise.all(processArray.map(BpmnParser.scanBpmnObjectForMessages)));
    }
    static mergeDedupeAndSort(arr) {
        return [...new Set(([].concat(...arr)).sort())];
    }
    /**
     * Return an array of task types.
     * @param bpmnObject - A parsed Bpmn object.
     */
    static async scanBpmnObjectForTasks(bpmnObject) {
        let taskTypes = []; // mutated in the recursive function
        await scanRecursively(bpmnObject);
        return [...new Set(taskTypes.sort())];
        async function scanRecursively(obj) {
            let k;
            if (obj instanceof Object) {
                for (k in obj) {
                    if (obj.hasOwnProperty(k)) {
                        if (k === "bpmn:serviceTask") {
                            const tasks = Array.isArray(obj[k]) ? obj[k] : [obj[k]];
                            taskTypes = taskTypes.concat(tasks.map((t) => t["bpmn:extensionElements"]["zeebe:taskDefinition"].attr["@_type"]));
                        }
                        else {
                            // recursive call to scan property
                            await scanRecursively(obj[k]);
                        }
                    }
                }
            }
            else {
                // not an Object so obj[k] here is a value
            }
        }
    }
    /**
     * Return an array of message names.
     * @param bpmnObject - A parsed Bpmn object.
     */
    static async scanBpmnObjectForMessages(bpmnObject) {
        let messageNames = []; // mutated in the recursive function
        await scanRecursively(bpmnObject);
        return [...new Set(messageNames.sort())];
        async function scanRecursively(obj) {
            let k;
            if (obj instanceof Object) {
                for (k in obj) {
                    if (obj.hasOwnProperty(k)) {
                        if (k === "bpmn:message") {
                            const messages = Array.isArray(obj[k]) ? obj[k] : [obj[k]];
                            messageNames = messageNames.concat(messages.map((m) => m.attr["@_name"]));
                        }
                        else {
                            // recursive call to scan property
                            await scanRecursively(obj[k]);
                        }
                    }
                }
            }
            else {
                // not an Object so obj[k] here is a value
            }
        }
    }
}
BpmnParser.parserOptions = {
    allowBooleanAttributes: false,
    attrNodeName: "attr",
    attributeNamePrefix: "@_",
    cdataPositionChar: "\\c",
    cdataTagName: "__cdata",
    ignoreAttributes: false,
    ignoreNameSpace: false,
    localeRange: "",
    parseAttributeValue: false,
    parseNodeValue: true,
    parseTrueNumberOnly: false,
    textNodeName: "#text",
    trimValues: true,
};
exports.BpmnParser = BpmnParser;
//# sourceMappingURL=BpmnParser.js.map