
export function fixJsonData(rawJson: string): any {
    const fixedJsonData = '[' + rawJson.replace(/}\s*{/g, '},{') + ']';
    return JSON.parse(fixedJsonData);
}